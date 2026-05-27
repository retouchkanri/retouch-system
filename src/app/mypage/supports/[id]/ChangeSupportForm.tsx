"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MembershipPlan, SupportSubscription } from "@/types/db";
import { formatYen } from "@/lib/format";

export default function ChangeSupportForm({
  support,
  plans,
}: {
  support: SupportSubscription;
  plans: MembershipPlan[];
}) {
  const router = useRouter();
  const currentUnitAmount = support.monthly_amount / Number(support.units || 1);
  const bestPlan =
    plans.find((p) => (p.unit_amount ?? p.monthly_amount) === Math.round(currentUnitAmount))?.id ??
    plans[0]?.id ??
    null;

  const [planId, setPlanId] = useState<string | null>(bestPlan);
  const [units, setUnits] = useState<number>(Number(support.units));
  const [mode, setMode] = useState<"edit" | "confirm">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId);
  const monthly = useMemo(() => {
    const per = plan?.unit_amount ?? plan?.monthly_amount ?? 0;
    return Math.round(per * units);
  }, [plan, units]);

  const prevUnits = Number(support.units);
  const prevMonthly = Number(support.monthly_amount);
  const diffMonthly = monthly - prevMonthly;
  const noChange = prevUnits === units && diffMonthly === 0;

  const save = async () => {
    if (!planId || units <= 0) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/mypage/supports/${support.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan_id: planId, units }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(j.error ?? "保存できませんでした。時間をおいて再度お試しください。");
      setMode("edit");
      return;
    }
    router.replace("/mypage");
    router.refresh();
  };

  if (mode === "confirm") {
    return (
      <div className="card space-y-4">
        <h2 className="section-title">変更内容のご確認</h2>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="text-ink-soft">項目</div>
          <div className="text-ink-soft text-center">変更前</div>
          <div className="text-ink-soft text-center">変更後</div>

          <div className="font-semibold">口数</div>
          <div className="text-center">{prevUnits} 口</div>
          <div className="text-center font-bold text-brand">{units} 口</div>

          <div className="font-semibold">月額</div>
          <div className="text-center">{formatYen(prevMonthly)}</div>
          <div className="text-center font-bold text-brand">{formatYen(monthly)}</div>
        </div>
        <div className="bg-brand-50 border border-brand-light rounded-xl p-3 text-sm">
          <p className="font-semibold">今回のお支払いへの影響</p>
          <p className="mt-1">
            {diffMonthly === 0
              ? "月額の変更はありません。"
              : diffMonthly > 0
                ? `次回以降の月額が ${formatYen(diffMonthly)} 増加します。当月分は日割り（プロレーション）で差額がご請求されます。`
                : `次回以降の月額が ${formatYen(Math.abs(diffMonthly))} 減少します。日割りの差額は次回請求に反映されます。`}
          </p>
        </div>
        {error && <p className="text-danger text-sm">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={() => setMode("edit")} disabled={saving}>
            戻る
          </button>
          <button className="btn-primary" onClick={save} disabled={saving || noChange}>
            {saving ? "処理中..." : "この内容で変更する"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label">支援内容</label>
        <div className="space-y-2">
          {plans.map((p) => (
            <label key={p.id} className={`border-2 rounded-xl p-3 flex items-center justify-between cursor-pointer
              ${planId === p.id ? "border-brand bg-brand-50" : "border-surface-line"}`}>
              <div>
                <p className="font-bold">{p.name}</p>
                <p className="text-sm text-ink-soft">1口 {formatYen(p.unit_amount ?? p.monthly_amount)} / 月</p>
              </div>
              <input type="radio" className="w-5 h-5" checked={planId === p.id} onChange={() => setPlanId(p.id)} />
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label">口数</label>
        <div className="flex items-center gap-3">
          <button type="button" className="btn-secondary !py-2 !px-4" onClick={() => setUnits((u) => Math.max(0.5, Math.round((u - 0.5) * 2) / 2))}>−</button>
          <input type="number" min={0.5} step={0.5} className="input text-center text-xl font-bold w-28" value={units} onChange={(e) => setUnits(Number(e.target.value))} />
          <button type="button" className="btn-secondary !py-2 !px-4" onClick={() => setUnits((u) => Math.round((u + 0.5) * 2) / 2)}>＋</button>
        </div>
      </div>

      <div className="bg-brand-50 border border-brand-light rounded-xl p-3">
        <p className="text-sm text-ink-soft">変更後の月額見込み</p>
        <p className="text-2xl font-bold text-brand">{formatYen(monthly)}</p>
        {!noChange && (
          <p className="text-xs text-ink-soft mt-1">
            現在の月額：{formatYen(prevMonthly)}（差額：{diffMonthly >= 0 ? "+" : ""}{formatYen(diffMonthly)}）
          </p>
        )}
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}
      <button
        className="btn-primary w-full"
        onClick={() => setMode("confirm")}
        disabled={!planId || units <= 0 || noChange}
      >
        変更内容を確認する
      </button>
    </div>
  );
}
