/**
 * Business rules around which plans can coexist.
 * - Only one of A / B / C can be active.
 * - SUPPORT (支援会員) cannot coexist with A/B/C.
 * - SPECIAL_TEAM can coexist with anything.
 */
export type PlanCode = "A" | "B" | "C" | "SPECIAL_TEAM" | "SUPPORT";

export function canCoexist(existing: PlanCode[], incoming: PlanCode): { ok: boolean; reason?: string } {
  const has = (c: PlanCode) => existing.includes(c);
  const basicExclusive: PlanCode[] = ["A", "B", "C"];

  if (basicExclusive.includes(incoming)) {
    if (has("A") || has("B") || has("C")) {
      return { ok: false, reason: "A/B/C会員のいずれかと併用はできません。変更してください。" };
    }
    if (has("SUPPORT")) {
      return { ok: false, reason: "支援会員とA/B/C会員は併用できません。" };
    }
    return { ok: true };
  }
  if (incoming === "SUPPORT") {
    if (has("A") || has("B") || has("C")) {
      return { ok: false, reason: "A/B/C会員と支援会員は併用できません。" };
    }
    return { ok: true };
  }
  // SPECIAL_TEAM: always ok
  return { ok: true };
}
