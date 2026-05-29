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
