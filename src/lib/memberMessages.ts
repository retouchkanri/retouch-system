import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "./notify";
import type { MemberMessage } from "@/types/db";

/**
 * 会員向けメッセージ配信エンジン（お知らせ閲覧 + メルマガ）。
 *
 * - 配信対象を materialize（member_message_recipients を1会員1行で生成）
 * - メール配信（HTML + テキスト）。開封ピクセル・配信停止リンクを埋め込む
 * - 大量送信に備え 1 呼び出しあたり時間/件数のバジェット内で送信し、
 *   未送信が残れば status='sending' のまま返す（cron / 再実行で続きを送る）
 * - 冪等: recipients は unique(message_id, customer_id)。送信済みは再送しない。
 */

const SEND_TIME_BUDGET_MS = 25_000;
const MAX_PER_CALL = Number(process.env.NEWSLETTER_BATCH ?? 80);

// ---------------------------------------------------------------------------
// HTML / text rendering
// ---------------------------------------------------------------------------

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** HTML本文からプレーンテキストの抜粋を作る（一覧のプレビュー用）。 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 配信物本文を、表示用の安全なHTML断片へ変換する。 */
export function messageBodyHtml(body: string, format: "html" | "text"): string {
  if (format === "text") return escapeHtml(body).replace(/\r?\n/g, "<br />");
  return body; // HTMLは管理者（スタッフ）が作成する信頼済みコンテンツ
}

function openPixelUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/api/track/open/${token}`;
}

function autoLinkUrls(html: string): string {
  return html.replace(/(<[^>]*>|https?:\/\/[^\s<>"']+)/g, (match) => {
    if (match.startsWith("<")) return match;
    return `<a href="${match}" style="color:#78716c;">${match}</a>`;
  });
}

function attachmentsHtml(imageUrls: string[], pdfUrls: string[]): string {
  const images = (imageUrls ?? []).filter(Boolean);
  const pdfs = (pdfUrls ?? []).filter(Boolean);
  if (images.length === 0 && pdfs.length === 0) return "";
  const imgHtml = images
    .map((url) => `<img src="${escapeHtml(url)}" alt="添付画像" style="display:block;width:100%;max-width:544px;margin:12px 0;border-radius:8px;" />`)
    .join("");
  const pdfHtml = pdfs.length
    ? `<div style="margin-top:12px;">${pdfs
        .map(
          (url, i) =>
            `<p style="margin:4px 0;"><a href="${escapeHtml(url)}" style="color:#0369a1;">📄 添付資料${pdfs.length > 1 ? `${i + 1}` : ""}（PDF）を開く</a></p>`,
        )
        .join("")}</div>`
    : "";
  return `${imgHtml}${pdfHtml}`;
}

/** メルマガ用の完全なHTMLメールを組み立てる（開封ピクセル・配信停止リンク込み）。 */
export function renderEmailHtml(params: {
  name: string | null;
  title: string;
  body: string;
  bodyFormat: "html" | "text";
  baseUrl: string;
  token: string;
  imageUrls?: string[];
  pdfUrls?: string[];
}): string {
  const who = (params.name?.trim() || "会員") + "様";
  const inner = autoLinkUrls(messageBodyHtml(params.body, params.bodyFormat));
  const attachments = attachmentsHtml(params.imageUrls ?? [], params.pdfUrls ?? []);
  const pixel = openPixelUrl(params.baseUrl, params.token);
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(params.title)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4;">
<tr><td style="padding:24px 28px 8px;font-family:'Hiragino Kaku Gothic ProN',Meiryo,sans-serif;color:#1c1917;">
<p style="margin:0 0 16px;font-size:14px;color:#57534e;">${escapeHtml(who)}</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.5;color:#1c1917;">${escapeHtml(params.title)}</h1>
<div style="font-size:15px;line-height:1.8;color:#292524;">${inner}</div>
${attachments}
</td></tr>
<tr><td style="padding:20px 28px 28px;font-family:'Hiragino Kaku Gothic ProN',Meiryo,sans-serif;">
<hr style="border:none;border-top:1px solid #e7e5e4;margin:0 0 16px;" />
<p style="margin:0;font-size:12px;color:#78716c;">Retouchメンバーズサイト 運営事務局</p>
</td></tr>
</table>
</td></tr>
</table>
<img src="${pixel}" width="1" height="1" alt="" style="display:none;border:0;" />
</body></html>`;
}

/** メールのテキストパート（HTMLを表示できないクライアント向け）。 */
export function renderEmailText(params: {
  name: string | null;
  title: string;
  body: string;
  bodyFormat: "html" | "text";
  baseUrl: string;
  token: string;
  imageUrls?: string[];
  pdfUrls?: string[];
}): string {
  const who = (params.name?.trim() || "会員") + "様";
  const bodyText = params.bodyFormat === "text" ? params.body : htmlToPlainText(params.body);
  const attachments = [...(params.imageUrls ?? []), ...(params.pdfUrls ?? [])].filter(Boolean);
  const attachmentsText = attachments.length
    ? `\n添付資料:\n${attachments.map((url) => `- ${url}`).join("\n")}\n`
    : "";
  return (
    `${who}\n\n` +
    `${params.title}\n\n` +
    `${bodyText}\n` +
    attachmentsText +
    `\n——————————————————\n` +
    `Retouchメンバーズサイト 運営事務局`
  );
}

// ---------------------------------------------------------------------------
// Audience & recipients
// ---------------------------------------------------------------------------

type AudienceCustomer = {
  id: string;
  email: string | null;
  full_name: string | null;
  newsletter_opt_out: boolean;
};

async function fetchCustomersByIds(admin: SupabaseClient, ids: string[]): Promise<AudienceCustomer[]> {
  if (ids.length === 0) return [];
  const pageSize = 500;
  const all: AudienceCustomer[] = [];
  for (let i = 0; i < ids.length; i += pageSize) {
    const { data } = await admin
      .from("customers")
      .select("id, email, full_name, newsletter_opt_out")
      .in("id", ids.slice(i, i + pageSize))
      .eq("status", "active");
    if (data) all.push(...(data as AudienceCustomer[]));
  }
  return all;
}

// 会員種別ごとの配信対象。v_customer_summary（顧客一覧の絞り込みと同一の定義）を
// customer_id だけ取得して絞り込み、fetchCustomersByIds で実データに解決する。
// アテンダー会員はメンバーズ会員(A)とコードを共有するため primary_plan_name で区別する
// （src/app/admin/(protected)/customers/page.tsx の cls フィルタと同じロジック）。
const VIEW_AUDIENCE_FILTERS: Record<string, (q: any) => any> = {
  rpt_only: (q) => q.eq("rpt_active", true),
  support_only: (q) => q.gt("total_support_horses", 0),
  // 空白の人のみ（無料会員）: 基本プランなし かつ リタポなし かつ 特別チーム(がんがん等)なし
  no_class: (q) => q.is("member_class_code", null).eq("rpt_active", false).eq("special_team_count", 0),
  class_attender: (q) => q.eq("primary_plan_name", "アテンダー会員"),
  class_a: (q) => q.eq("member_class_code", "A").neq("primary_plan_name", "アテンダー会員"),
  class_b: (q) => q.eq("member_class_code", "B"),
  class_c: (q) => q.eq("member_class_code", "C"),
  class_owner: (q) => q.eq("member_class_code", "OWNER"),
  class_support: (q) => q.eq("member_class_code", "SUPPORT"),
  team_only: (q) => q.gt("special_team_count", 0),
};

async function resolveAudienceCustomers(
  admin: SupabaseClient,
  msg: MemberMessage,
): Promise<AudienceCustomer[]> {
  if (msg.audience === "subset") {
    const ids = msg.target_customer_ids ?? [];
    if (ids.length === 0) return [];
    const { data } = await admin
      .from("customers")
      .select("id, email, full_name, newsletter_opt_out")
      .in("id", ids)
      .eq("status", "active");
    return (data as AudienceCustomer[]) ?? [];
  }

  const viewFilter = VIEW_AUDIENCE_FILTERS[msg.audience];
  if (viewFilter) {
    let q = admin.from("v_customer_summary").select("customer_id").eq("status", "active");
    q = viewFilter(q);
    const { data } = await q;
    const ids = ((data ?? []) as any[]).map((r) => r.customer_id as string);
    return fetchCustomersByIds(admin, ids);
  }

  // audience = 'all' → 全アクティブ会員（1000件上限を超える場合に備えページング）
  const all: AudienceCustomer[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data } = await admin
      .from("customers")
      .select("id, email, full_name, newsletter_opt_out")
      .eq("status", "active")
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    all.push(...(data as AudienceCustomer[]));
    if (data.length < pageSize) break;
  }
  return all;
}

async function recomputeCounts(admin: SupabaseClient, messageId: string) {
  const base = () =>
    admin
      .from("member_message_recipients")
      .select("id", { count: "exact", head: true })
      .eq("message_id", messageId);
  const { count: total } = await base();
  const { count: sent } = await base().eq("email_status", "sent");
  const { count: pending } = await base().eq("email_status", "pending");
  return { total: total ?? 0, sent: sent ?? 0, pending: pending ?? 0 };
}

// ---------------------------------------------------------------------------
// Send orchestration
// ---------------------------------------------------------------------------

export type SendResult = {
  ok: boolean;
  status: string;
  recipientCount: number;
  sentCount: number;
  remaining: number;
  error?: string;
};

/**
 * メッセージを配信する。メール未送信が残れば status='sending' のまま返し、
 * cron / 再実行で続きを送る。in-app のみ（メールなし）の場合は即 'sent'。
 */
export async function sendMemberMessage(
  admin: SupabaseClient,
  messageId: string,
  opts: { baseUrl: string },
): Promise<SendResult> {
  const { data: msg } = await admin
    .from("member_messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) {
    return { ok: false, status: "missing", recipientCount: 0, sentCount: 0, remaining: 0, error: "message not found" };
  }
  const message = msg as MemberMessage;
  if (message.status === "sent" || message.status === "canceled") {
    return {
      ok: true,
      status: message.status,
      recipientCount: message.recipient_count,
      sentCount: message.sent_count,
      remaining: 0,
    };
  }

  // 配信中に遷移
  await admin.from("member_messages").update({ status: "sending" }).eq("id", messageId);

  // 配信先を未生成なら materialize（1会員1行・冪等）
  const { count: existing } = await admin
    .from("member_message_recipients")
    .select("id", { count: "exact", head: true })
    .eq("message_id", messageId);
  if (!existing) {
    const customers = await resolveAudienceCustomers(admin, message);
    const rows = customers.map((c) => ({
      message_id: messageId,
      customer_id: c.id,
      email: c.email,
      email_status:
        message.channel_email && c.email && !c.newsletter_opt_out ? "pending" : "skipped",
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await admin
        .from("member_message_recipients")
        .upsert(rows.slice(i, i + 500), {
          onConflict: "message_id,customer_id",
          ignoreDuplicates: true,
        });
    }
  }

  // メール配信（時間/件数バジェット内）
  if (message.channel_email) {
    const start = Date.now();
    let processed = 0;
    while (processed < MAX_PER_CALL && Date.now() - start < SEND_TIME_BUDGET_MS) {
      const { data: batch } = await admin
        .from("member_message_recipients")
        .select("id, customer_id, email, token, customer:customers(full_name)")
        .eq("message_id", messageId)
        .eq("email_status", "pending")
        .limit(10);
      if (!batch || batch.length === 0) break;
      for (const r of batch as any[]) {
        if (processed >= MAX_PER_CALL || Date.now() - start >= SEND_TIME_BUDGET_MS) break;
        const name = r.customer?.full_name ?? null;
        const html = renderEmailHtml({
          name,
          title: message.title,
          body: message.body,
          bodyFormat: message.body_format,
          baseUrl: opts.baseUrl,
          token: r.token,
          imageUrls: message.image_urls,
          pdfUrls: message.pdf_urls,
        });
        const text = renderEmailText({
          name,
          title: message.title,
          body: message.body,
          bodyFormat: message.body_format,
          baseUrl: opts.baseUrl,
          token: r.token,
          imageUrls: message.image_urls,
          pdfUrls: message.pdf_urls,
        });
        const res = await notify({
          kind: "member_message",
          to: r.email,
          to_name: name,
          subject: message.title,
          body_text: text,
          body_html: html,
          meta: { message_id: messageId, recipient_id: r.id },
        });
        await admin
          .from("member_message_recipients")
          .update({
            email_status: res.sent ? "sent" : "failed",
            sent_at: res.sent ? new Date().toISOString() : null,
            error: res.sent ? null : res.error ?? "send failed",
          })
          .eq("id", r.id);
        processed++;
      }
    }
  }

  const counts = await recomputeCounts(admin, messageId);
  const done = counts.pending === 0;
  await admin
    .from("member_messages")
    .update({
      recipient_count: counts.total,
      sent_count: counts.sent,
      status: done ? "sent" : "sending",
      sent_at: done ? message.sent_at ?? new Date().toISOString() : message.sent_at,
    })
    .eq("id", messageId);

  return {
    ok: true,
    status: done ? "sent" : "sending",
    recipientCount: counts.total,
    sentCount: counts.sent,
    remaining: counts.pending,
  };
}
