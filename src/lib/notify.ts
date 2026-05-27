import nodemailer, { type Transporter } from "nodemailer";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * Notification layer.
 *
 * Transports (selected via NOTIFY_TRANSPORT env):
 *   - "smtp"  : nodemailer (Gmail SMTP via SMTP_* env). Default in this project.
 *   - "resend": Resend HTTP API (RESEND_API_KEY).
 *   - "audit" : no actual delivery, only audit_logs trail (dev/local).
 *
 * Every send attempt — successful or not — writes an `audit_logs`
 * row so the admin can trace mail history at /admin/audit-logs.
 */

export type NotifyKind =
  | "donation_thanks"
  | "booking_confirmed"
  | "booking_canceled"
  | "payment_failed"
  | "plan_changed"
  | "support_added"
  | "support_changed"
  | "support_canceled";

export type NotifyPayload = {
  kind: NotifyKind;
  to: string | null;
  to_name?: string | null;
  subject: string;
  body_text: string;
  meta?: Record<string, unknown>;
};

const FROM_NAME_DEFAULT = "Retouchメンバーズ事務局";
const SITE_URL_DEFAULT = "https://retouch-members.local";
const CONTACT_EMAIL_DEFAULT = "info@retouch-members.local";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL_DEFAULT;
}

function contactEmail() {
  return process.env.CONTACT_EMAIL ?? process.env.MAIL_FROM ?? CONTACT_EMAIL_DEFAULT;
}

function fromHeader(): string {
  const addr = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "no-reply@retouch-members.local";
  const name = process.env.MAIL_FROM_NAME ?? FROM_NAME_DEFAULT;
  return `${name} <${addr}>`;
}

let _smtp: Transporter | null = null;
function smtpTransport(): Transporter | null {
  if (_smtp) return _smtp;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = (process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false";
  _smtp = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return _smtp;
}

async function sendViaSmtp(p: NotifyPayload): Promise<{ ok: boolean; error?: string }> {
  if (!p.to) return { ok: false, error: "no recipient" };
  const tx = smtpTransport();
  if (!tx) return { ok: false, error: "smtp not configured" };
  try {
    await tx.sendMail({
      from: fromHeader(),
      to: p.to_name ? `${p.to_name} <${p.to}>` : p.to,
      subject: p.subject,
      text: p.body_text,
      replyTo: contactEmail(),
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "smtp send failed" };
  }
}

async function sendViaResend(p: NotifyPayload): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !p.to) return { ok: false, error: "resend not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader(),
        to: [p.to],
        subject: p.subject,
        text: p.body_text,
        reply_to: contactEmail(),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `resend http ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "resend send failed" };
  }
}

export async function notify(payload: NotifyPayload): Promise<{
  sent: boolean;
  transport: string;
  error?: string;
}> {
  const transport = (process.env.NOTIFY_TRANSPORT ?? "smtp").toLowerCase();
  let result: { ok: boolean; error?: string } = { ok: false, error: "no transport" };

  if (payload.to) {
    if (transport === "smtp") result = await sendViaSmtp(payload);
    else if (transport === "resend") result = await sendViaResend(payload);
    else result = { ok: false, error: "audit-only mode" };
  } else {
    result = { ok: false, error: "no recipient" };
  }

  try {
    const admin = createSupabaseAdminClient();
    await admin.from("audit_logs").insert({
      action: `notify.${payload.kind}`,
      target_table: "notifications",
      meta: {
        to: payload.to,
        to_name: payload.to_name ?? null,
        subject: payload.subject,
        preview: payload.body_text.slice(0, 400),
        transport,
        sent: result.ok,
        error: result.error ?? null,
        ...(payload.meta ?? {}),
      },
    });
  } catch {
    // logging must not break the caller
  }
  return { sent: result.ok, transport, error: result.error };
}

// =====================================================================
// Templates
// =====================================================================

function signature(): string {
  return (
    `\n\n` +
    `——————————————————\n` +
    `Retouchメンバーズサイト 運営事務局\n` +
    `お問い合わせ: ${contactEmail()}\n` +
    `マイページ: ${siteUrl()}/mypage`
  );
}

function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function donationThanksTemplate(params: {
  name: string | null;
  amount: number;
}): Pick<NotifyPayload, "subject" | "body_text"> {
  const who = params.name?.trim() || "ご支援者";
  return {
    subject: "【Retouch Members】ご寄付ありがとうございます",
    body_text:
      `${who}様\n\n` +
      `このたびは引退競走馬への温かいご寄付（${yen(params.amount)}）を賜り、誠にありがとうございます。\n` +
      `いただいたご支援は、馬たちのケア・見学会の運営にありがたく活用させていただきます。\n\n` +
      `本メールは寄付受付の確認としてお送りしております。` +
      signature(),
  };
}

export function paymentFailedTemplate(params: {
  name: string | null;
  contractId: string;
}): Pick<NotifyPayload, "subject" | "body_text"> {
  const who = params.name?.trim() || "会員";
  return {
    subject: "【Retouch Members】お支払いに関するご確認のお願い",
    body_text:
      `${who}様\n\n` +
      `ご登録のクレジットカードで決済が完了できない状況です。\n` +
      `お手数ですが、マイページ「お支払い情報を変更」よりカード情報のご確認・更新をお願いいたします。\n\n` +
      `更新後、自動的に再決済が行われます。手続き後にご不明な点がございましたら、本メールへご返信ください。` +
      signature(),
  };
}

export function bookingConfirmedTemplate(params: {
  name: string | null;
  eventTitle: string;
  startsAt: string | Date;
}): Pick<NotifyPayload, "subject" | "body_text"> {
  const who = params.name?.trim() || "会員";
  const d = typeof params.startsAt === "string" ? new Date(params.startsAt) : params.startsAt;
  const when = Number.isNaN(d.getTime())
    ? String(params.startsAt)
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return {
    subject: `【Retouch Members】ご予約完了のお知らせ — ${params.eventTitle}`,
    body_text:
      `${who}様\n\n` +
      `以下の見学会のご予約を承りました。\n\n` +
      `・イベント: ${params.eventTitle}\n` +
      `・日時: ${when}\n\n` +
      `当日の詳細・集合場所は別途ご連絡いたします。\n` +
      `ご予約のキャンセル・人数変更はマイページからお手続きいただけます。` +
      signature(),
  };
}

export function planChangedTemplate(params: {
  name: string | null;
  planName: string;
  monthly: number;
}): Pick<NotifyPayload, "subject" | "body_text"> {
  const who = params.name?.trim() || "会員";
  return {
    subject: `【Retouch Members】会員種別を変更しました — ${params.planName}`,
    body_text:
      `${who}様\n\n` +
      `会員種別を「${params.planName}（月額 ${yen(params.monthly)}）」に変更いたしました。\n` +
      `引き続きご支援のほどよろしくお願い申し上げます。` +
      signature(),
  };
}

export function supportAddedTemplate(params: {
  name: string | null;
  horseName: string;
  units: number;
  monthly: number;
}): Pick<NotifyPayload, "subject" | "body_text"> {
  const who = params.name?.trim() || "ご支援者";
  const u = Number.isInteger(params.units) ? `${params.units}口` : `${params.units.toFixed(1)}口`;
  return {
    subject: `【Retouch Members】支援お申し込み完了のお知らせ — ${params.horseName}`,
    body_text:
      `${who}様\n\n` +
      `以下の内容で支援のお申し込みを承りました。\n\n` +
      `・対象馬: ${params.horseName}\n` +
      `・口数: ${u}\n` +
      `・月額: ${yen(params.monthly)}\n\n` +
      `次回以降、毎月ご請求させていただきます。\n` +
      `心温まるご支援を誠にありがとうございます。` +
      signature(),
  };
}

export function supportChangedTemplate(params: {
  name: string | null;
  horseName: string;
  prevUnits: number;
  prevMonthly: number;
  newUnits: number;
  newMonthly: number;
}): Pick<NotifyPayload, "subject" | "body_text"> {
  const who = params.name?.trim() || "ご支援者";
  const fmt = (n: number) => (Number.isInteger(n) ? `${n}口` : `${n.toFixed(1)}口`);
  return {
    subject: `【Retouch Members】支援内容変更のお知らせ — ${params.horseName}`,
    body_text:
      `${who}様\n\n` +
      `${params.horseName}の支援内容を以下のとおり変更いたしました。\n\n` +
      `【変更前】 ${fmt(params.prevUnits)} / 月額 ${yen(params.prevMonthly)}\n` +
      `【変更後】 ${fmt(params.newUnits)} / 月額 ${yen(params.newMonthly)}\n\n` +
      `Stripeの仕様により、月の途中での変更は日割り計算にて差額が次回請求に反映されます。` +
      signature(),
  };
}

export function supportCanceledTemplate(params: {
  name: string | null;
  horseName: string;
  scheduledAt: string | null;
}): Pick<NotifyPayload, "subject" | "body_text"> {
  const who = params.name?.trim() || "ご支援者";
  const when = params.scheduledAt
    ? (() => {
        const d = new Date(params.scheduledAt as string);
        return Number.isNaN(d.getTime())
          ? null
          : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      })()
    : null;
  return {
    subject: `【Retouch Members】支援停止 受付のお知らせ — ${params.horseName}`,
    body_text:
      `${who}様\n\n` +
      `${params.horseName}の支援停止のお申し込みを承りました。\n\n` +
      (when
        ? `・終了予定日: ${when}\n  当日まではご支援を継続いただけます。\n\n`
        : `・即日で停止いたしました。\n\n`) +
      `これまでの温かいご支援、誠にありがとうございました。` +
      signature(),
  };
}
