/**
 * Runtime feature flags.
 *
 * Kept deliberately simple (env-driven) so behaviour can be toggled in
 * production without a code change / redeploy.
 */

/**
 * Whether NEW 特別チーム会員 (¥1,000 special team) sign-ups are accepted.
 *
 * Disabled by default at the client's request: existing ¥1,000 subscribers
 * keep their memberships untouched, but no new applications are taken.
 * To re-open sign-ups, set NEXT_PUBLIC_SPECIAL_TEAM_SIGNUPS=true.
 */
export const SPECIAL_TEAM_NEW_SIGNUPS_ENABLED =
  process.env.NEXT_PUBLIC_SPECIAL_TEAM_SIGNUPS === "true";

/**
 * 会員（マイページ）によるセルフサービス操作の可否。
 *
 * 運用方針の変更により、各種お手続き（一口支援・会員種別・特別チーム・寄付・
 * 予約・馬の面会・登録情報など）の「追加・変更・削除」は管理者が管理画面から
 * 行う運用にしたため、既定で false（会員は閲覧のみ）。
 *
 * これに伴い、対象のマイページ操作ボタンは非表示にし、対応するミューテーション
 * API はスタッフ以外からのアクセスを 403 で拒否する（{@link memberMutationGuard}）。
 *
 * 会員によるセルフ操作を再開する場合は NEXT_PUBLIC_MEMBER_SELF_SERVICE=true を設定する。
 *
 * 注: アカウント情報（メール／パスワード）の変更と、Stripe のお支払い方法
 * （カード）変更は「項目の追加・変更・削除」ではなくアカウント保全・決済手段の
 * 管理にあたるため、この制限の対象外（従来どおり会員が操作可能）。
 */
export const MEMBER_SELF_SERVICE_ENABLED =
  process.env.NEXT_PUBLIC_MEMBER_SELF_SERVICE === "true";
