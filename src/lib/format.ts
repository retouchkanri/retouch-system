export function formatYen(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `¥${Math.round(amount).toLocaleString("ja-JP")}`;
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (!withTime) return `${y}/${m}/${day}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export function formatUnits(units: number | null | undefined): string {
  if (units == null) return "—";
  const n = Number(units);
  if (Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? `${n}口` : `${n.toFixed(1)}口`;
}

export function genderLabel(gender: string | null | undefined): string {
  switch (gender) {
    case "male":
      return "男性";
    case "female":
      return "女性";
    case "other":
      return "その他";
    case "unspecified":
      return "未指定";
    default:
      return "—";
  }
}

export function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "正常";
    case "past_due":
      return "決済失敗";
    case "canceled":
      return "停止";
    case "paused":
      return "一時停止";
    case "incomplete":
      return "手続き中";
    case "succeeded":
      return "成功";
    case "failed":
      return "失敗";
    case "pending":
      return "保留";
    case "refunded":
      return "返金済";
    case "reserved":
      return "予約中";
    case "attended":
      return "参加済";
    case "no_show":
      return "不参加";
    case "suspended":
      return "停止中";
    case "withdrawn":
      return "退会済";
    default:
      return status ?? "—";
  }
}
