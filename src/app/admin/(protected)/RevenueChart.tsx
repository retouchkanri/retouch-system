"use client";

import { useMemo, useState } from "react";
import type { RevenuePeriod, RevenueSeries } from "@/lib/revenueSeries";

const PERIODS: { key: RevenuePeriod; label: string }[] = [
  { key: "day", label: "日" },
  { key: "week", label: "週" },
  { key: "month", label: "月" },
  { key: "year", label: "年" },
];

// ── 座標系（viewBox） ──
const W = 360;
const H = 176;
const PAD_L = 46; // 左の価格ラベル用の余白
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26; // 下の期間ラベル用の余白
const PLOT_X0 = PAD_L;
const PLOT_X1 = W - PAD_R;
const PLOT_Y0 = PAD_T; // 上端
const PLOT_Y1 = H - PAD_B; // 基線
const PLOT_W = PLOT_X1 - PLOT_X0;
const PLOT_H = PLOT_Y1 - PLOT_Y0;

/** 軸用のコンパクトな円表記（例: ¥1.2万 / ¥500 / ¥3億）。 */
function axisYen(v: number): string {
  if (v <= 0) return "¥0";
  if (v >= 1e8) return `¥${(v / 1e8).toFixed(v % 1e8 === 0 ? 0 : 1)}億`;
  if (v >= 1e4) return `¥${(v / 1e4).toFixed(v % 1e4 === 0 ? 0 : 1)}万`;
  return `¥${Math.round(v).toLocaleString("ja-JP")}`;
}

/** 正確な金額表記（ツールチップ用）。 */
function fullYen(v: number): string {
  return `¥${Math.round(v).toLocaleString("ja-JP")}`;
}

/** きりの良い上限値（軸の最大目盛り）。 */
function niceCeil(x: number): number {
  if (x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const base = Math.pow(10, exp);
  const f = x / base;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * base;
}

/** 単調（Fritsch–Carlson）な 3 次スプライン。データ点を正確に通り、行き過ぎない。 */
function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  if (n === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    slope[i] = (ys[i + 1] - ys[i]) / dx[i];
  }
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const cp1x = xs[i] + dx[i] / 3;
    const cp1y = ys[i] + (m[i] * dx[i]) / 3;
    const cp2x = xs[i + 1] - dx[i] / 3;
    const cp2y = ys[i + 1] - (m[i + 1] * dx[i]) / 3;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

export default function RevenueChart({ series }: { series: RevenueSeries }) {
  const [period, setPeriod] = useState<RevenuePeriod>("month");
  const [hover, setHover] = useState<number | null>(null);

  const data = series[period];

  const view = useMemo(() => {
    const n = data.length;
    const maxVal = Math.max(...data.map((d) => d.total), 0);
    const top = niceCeil(maxVal);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);

    const pts = data.map((d, i) => {
      const x = n <= 1 ? (PLOT_X0 + PLOT_X1) / 2 : PLOT_X0 + (i / (n - 1)) * PLOT_W;
      const y = PLOT_Y1 - (top > 0 ? (d.total / top) * PLOT_H : 0);
      return { x, y };
    });

    const linePath = monotonePath(pts);
    const areaPath =
      pts.length >= 2
        ? `${linePath} L${pts[pts.length - 1].x},${PLOT_Y1} L${pts[0].x},${PLOT_Y1} Z`
        : "";

    // x 軸ラベルの間引き（多すぎると重なるため）。
    const step = Math.max(1, Math.ceil(n / 8));

    return { n, maxVal, ticks, pts, linePath, areaPath, step };
  }, [data]);

  const hasData = view.maxVal > 0;
  const hp = hover != null ? view.pts[hover] : null;

  return (
    <div>
      {/* ヘッダー: タイトル + 期間切替 */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h2 className="text-lg font-bold text-ink flex items-center gap-2">収益推移</h2>
        <div className="inline-flex rounded-lg border border-surface-line bg-surface-soft p-0.5">
          {PERIODS.map((p) => {
            const active = p.key === period;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPeriod(p.key);
                  setHover(null);
                }}
                aria-pressed={active}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  active
                    ? "bg-white text-brand-dark font-bold shadow-sm"
                    : "text-ink-mute hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="収益推移チャート"
        >
          <defs>
            <linearGradient id="adminChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3d8b6e" stopOpacity="0.22" />
              <stop offset="70%" stopColor="#3d8b6e" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#3d8b6e" stopOpacity="0" />
            </linearGradient>
            <filter id="lineShadow" x="-4%" y="-10%" width="108%" height="130%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#1b4332" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* 横グリッド + 左の価格ラベル */}
          {view.ticks.map((tv, i) => {
            const y = PLOT_Y1 - (view.ticks.length > 1 ? (i / (view.ticks.length - 1)) * PLOT_H : 0);
            return (
              <g key={i}>
                <line
                  x1={PLOT_X0}
                  y1={y}
                  x2={PLOT_X1}
                  y2={y}
                  stroke="#e9edf0"
                  strokeWidth="0.6"
                  strokeDasharray={i === 0 ? "0" : "2 3"}
                />
                <text
                  x={PLOT_X0 - 6}
                  y={y + 2.6}
                  textAnchor="end"
                  className="fill-ink-mute"
                  style={{ fontSize: 7.5 }}
                >
                  {axisYen(tv)}
                </text>
              </g>
            );
          })}

          {hasData && (
            <>
              {/* エリア塗り */}
              {view.areaPath && <path d={view.areaPath} fill="url(#adminChartGrad)" />}
              {/* 本線（単調スプライン） */}
              <path
                d={view.linePath}
                fill="none"
                stroke="#2d6a4f"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#lineShadow)"
              />
              {/* ホバー時の縦ガイド */}
              {hp && (
                <line
                  x1={hp.x}
                  y1={PLOT_Y0}
                  x2={hp.x}
                  y2={PLOT_Y1}
                  stroke="#2d6a4f"
                  strokeWidth="0.6"
                  strokeDasharray="2 2"
                  opacity="0.5"
                />
              )}
              {/* データ点 */}
              {view.pts.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hover === i ? 3 : 2.2}
                    fill="white"
                    stroke="#2d6a4f"
                    strokeWidth={hover === i ? 1.3 : 0.9}
                  />
                  {hover === i && <circle cx={p.x} cy={p.y} r="1.1" fill="#2d6a4f" />}
                  {/* 当たり判定（透明・広め） */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="9"
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "pointer" }}
                  />
                </g>
              ))}
              {/* ホバー時の値ラベル（白フチで可読性を確保） */}
              {hp && hover != null && (
                <text
                  x={Math.min(Math.max(hp.x, PLOT_X0 + 16), PLOT_X1 - 16)}
                  y={Math.max(hp.y - 6, PLOT_Y0 + 6)}
                  textAnchor="middle"
                  className="fill-brand-dark"
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    paintOrder: "stroke",
                    stroke: "white",
                    strokeWidth: 2.5,
                    strokeLinejoin: "round",
                  }}
                >
                  {fullYen(data[hover].total)}
                </text>
              )}
            </>
          )}

          {/* x 軸ラベル（間引き） */}
          {view.pts.map((p, i) => {
            if (i % view.step !== 0 && i !== view.n - 1) return null;
            return (
              <text
                key={i}
                x={p.x}
                y={H - 9}
                textAnchor="middle"
                className={hover === i ? "fill-ink font-bold" : "fill-ink-mute"}
                style={{ fontSize: 7.5 }}
              >
                {data[i].label}
              </text>
            );
          })}
        </svg>

        {!hasData && (
          <p className="text-xs text-ink-mute text-center mt-2">この期間の決済データはまだありません</p>
        )}

        {/* ホバー詳細（チャート下のキャプション） */}
        <p className="mt-1.5 text-center text-xs text-ink-mute h-4">
          {hover != null ? (
            <span>
              <span className="text-ink-soft">{data[hover].tip}</span>
              <span className="mx-1.5 text-surface-line">|</span>
              <span className="font-bold text-brand-dark tabular-nums">{fullYen(data[hover].total)}</span>
            </span>
          ) : (
            "点にカーソルを合わせると詳細を表示します"
          )}
        </p>
      </div>
    </div>
  );
}
