"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ResetUpdateForm() {
  const supabase = getSupabaseBrowserClient();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The email link lands here. Establish the recovery session from the URL:
  //  - implicit flow: token already in the URL hash → detected on client init.
  //  - PKCE flow: exchange the ?code= for a session (same-browser verifier).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          if (active) { setReady(true); setChecking(false); }
          return;
        }
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (active) {
            if (error) setLinkError("リンクが無効か、有効期限が切れています。お手数ですが再度お試しください。");
            else setReady(true);
            setChecking(false);
          }
          return;
        }
        if (active) {
          setLinkError("無効なアクセスです。パスワード再設定メールのリンクから開いてください。");
          setChecking(false);
        }
      } catch {
        if (active) {
          setLinkError("確認に失敗しました。お手数ですが再度お試しください。");
          setChecking(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("パスワードは8文字以上で設定してください。");
      return;
    }
    if (password !== confirm) {
      setError("パスワードが一致しません。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError("更新に失敗しました。再度お試しください。");
        return;
      }
      await supabase.auth.signOut();
      setDone(true);
    } catch {
      setError("通信エラーが発生しました。再度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return <p className="text-sm text-ink-soft text-center py-4">確認中...</p>;
  }
  if (done) {
    return (
      <div className="text-center">
        <p className="text-brand-dark font-bold mb-2">パスワードを変更しました。</p>
        <p className="text-ink-soft text-sm">新しいパスワードでログインしてください。</p>
        <Link href="/login" className="mt-5 inline-block text-brand underline text-sm">
          ログインへ進む
        </Link>
      </div>
    );
  }
  if (linkError) {
    return (
      <div className="text-center">
        <p className="text-danger text-sm mb-4 leading-relaxed">{linkError}</p>
        <Link href="/login/reset" className="text-brand underline text-sm">
          再設定メールを送り直す
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">新しいパスワードを設定してください。</p>
      <div>
        <label className="label" htmlFor="new-pass">新しいパスワード（8文字以上）</label>
        <input
          id="new-pass"
          type="password"
          required
          autoComplete="new-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="new-pass2">新しいパスワード（確認）</label>
        <input
          id="new-pass2"
          type="password"
          required
          autoComplete="new-password"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy || !ready}>
        {busy ? "更新中..." : "パスワードを変更"}
      </button>
    </form>
  );
}
