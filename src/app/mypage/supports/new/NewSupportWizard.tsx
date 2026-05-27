"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Horse, MembershipPlan } from "@/types/db";
import { formatYen } from "@/lib/format";

type Props = {
  horses: Horse[];
  plans: MembershipPlan[];
  existingHorseIds: string[];
  disabled: boolean;
};

export default function NewSupportWizard({ horses, plans, existingHorseIds, disabled }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [horseId, setHorseId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(plans[0]?.id ?? null);
  const [units, setUnits] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedHorse = horses.find((h) => h.id === horseId) ?? null;
  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const monthly = useMemo(() => {
    const per = selectedPlan?.unit_amount ?? selectedPlan?.monthly_amount ?? 0;
    return Math.round(per * units);
  }, [selectedPlan, units]);

  const submit = async () => {
    if (!horseId || !planId || units <= 0) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/mypage/supports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ horse_id: horseId, plan_id: planId, units }),
    });
    const j = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(j.error ?? "登録できませんでした。");
      return;
    }
    if (j.checkout_url) {
      window.location.href = j.checkout_url;
      return;
    }
    router.replace("/mypage/supports/completed");
    router.refresh();
  };

  return (
    <div className="card space-y-4">
      <ol className="flex items-center gap-2 text-sm">
        {[1, 2, 3].map((n) => (
          <li key={n} className={`flex-1 py-2 text-center rounded-lg font-semibold
            ${n === step ? "bg-brand text-white" : n < step ? "bg-brand-50 text-brand" : "bg-surface-soft text-ink-mute"}`}>
            STEP {n}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div>
          <h2 className="section-title">支援する馬を選ぶ</h2>
          <div className="grid gap-2 max-h-[55vh] overflow-auto">
            {horses.map((h) => {
              const owned = existingHorseIds.includes(h.id);
              return (
                <label
                  key={h.id}
                  className={`border-2 rounded-xl p-3 flex items-center gap-3 cursor-pointer
                    ${horseId === h.id ? "border-brand bg-brand-50" : "border-surface-line"}`}
                >
                  <input
                    type="radio"
                    className="w-5 h-5"
                    name="horse"
                    checked={horseId === h.id}
                    onChange={() => setHorseId(h.id)}
                    disabled={disabled}
                  />
                  <div className="flex-1">
                    <p className="font-bold">
                      {h.name}
                      {owned && <span className="chip-warn ml-2">支援中（口数を追加）</span>}
                    </p>
                    <p className="text-xs text-ink-soft line-clamp-2">{h.profile ?? ""}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex justify-between mt-4">
            <span />
            <button className="btn-primary" disabled={!horseId || disabled} onClick={() => setStep(2)}>
              次へ進む
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="section-title">口数と種類を選ぶ</h2>
          <div className="space-y-2 mb-4">
            {plans.map((p) => (
              <label key={p.id} className={`border-2 rounded-xl p-3 flex items-center justify-between cursor-pointer
                ${planId === p.id ? "border-brand bg-brand-50" : "border-surface-line"}`}>
                <div>
                  <p className="font-bold">{p.name}</p>
                  <p className="text-sm text-ink-soft">1口あたり {formatYen(p.unit_amount ?? p.monthly_amount)} / 月</p>
                </div>
                <input
                  type="radio"
                  className="w-5 h-5"
                  name="plan"
                  checked={planId === p.id}
                  onChange={() => setPlanId(p.id)}
                />
              </label>
            ))}
          </div>
          <div>
            <label className="label">口数</label>
            <div className="flex items-center gap-3">
              <button type="button" className="btn-secondary !py-2 !px-4" onClick={() => setUnits((u) => Math.max(0.5, Math.round((u - 0.5) * 2) / 2))}>−</button>
              <input
                type="number" min={0.5} step={0.5}
                className="input text-center text-xl font-bold w-28"
                value={units}
                onChange={(e) => setUnits(Number(e.target.value))}
              />
              <button type="button" className="btn-secondary !py-2 !px-4" onClick={() => setUnits((u) => Math.round((u + 0.5) * 2) / 2)}>＋</button>
            </div>
            <p className="mt-3 text-ink-soft">月額見込み：<span className="text-xl font-bold text-brand">{formatYen(monthly)}</span></p>
          </div>
          <div className="flex justify-between mt-4">
            <button className="btn-ghost" onClick={() => setStep(1)}>戻る</button>
            <button className="btn-primary" disabled={!planId || units <= 0} onClick={() => setStep(3)}>内容を確認する</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="section-title">内容確認</h2>
          <dl className="divide-y divide-surface-line mb-4">
            <div className="py-3 flex justify-between"><dt className="text-ink-soft">支援する馬</dt><dd className="font-bold">{selectedHorse?.name}</dd></div>
            <div className="py-3 flex justify-between"><dt className="text-ink-soft">支援内容</dt><dd className="font-bold">{selectedPlan?.name}</dd></div>
            <div className="py-3 flex justify-between"><dt className="text-ink-soft">口数</dt><dd className="font-bold">{units} 口</dd></div>
            <div className="py-3 flex justify-between"><dt className="text-ink-soft">月額見込み</dt><dd className="font-bold text-brand">{formatYen(monthly)}</dd></div>
          </dl>
          {error && <p className="text-danger text-sm mb-2">{error}</p>}
          <div className="flex justify-between">
            <button className="btn-ghost" onClick={() => setStep(2)}>戻る</button>
            <button className="btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? "処理中..." : "この内容で申し込む"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
