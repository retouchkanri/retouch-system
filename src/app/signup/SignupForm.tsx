"use client";

import Link from "next/link";
import { useState } from "react";
import PasswordInput, { EmailInput } from "@/components/PasswordInput";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 送信完了後に表示する「仮会員登録完了」モーダルの対象メール。
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("パスワードが一致しません。確認用と同じパスワードを入力してください。");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/registration/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "登録に失敗しました。");
        return;
      }
      setSentTo(email);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
      <p className="text-center text-sm font-semibold text-ink-soft">新規会員登録</p>
      <p className="text-center text-xs text-ink-mute -mt-1">
        ログイン不要で、どなたでも登録いただけます。
      </p>

      <div>
        <label className="label" htmlFor="email">
          メールアドレス
        </label>
        <EmailInput
          id="email"
          name="email"
          autoComplete="email"
          required
          placeholder="メールアドレスを入力してください"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          パスワード（8文字以上）
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          showLockIcon
          placeholder="パスワードを入力してください"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="confirmPassword">
          パスワード（確認）
        </label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          showLockIcon
          placeholder="確認のためもう一度入力してください"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      <p className="text-center text-xs">
        <Link href="/guide" className="text-brand underline">
          ご入会のご案内（会員制度・特典）を読む
        </Link>
      </p>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button className="btn-primary w-full" type="submit" disabled={loading}>
        {loading ? "送信中..." : "確認メールを送信する"}
      </button>

      <p className="text-center text-xs text-ink-mute">
        ご入力のメール宛に確認リンクをお送りします。リンクからアカウント作成へお進みください。
      </p>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-surface-line" />
        </div>
        <p className="relative text-center text-sm text-ink-mute">
          <span className="bg-white px-3">または</span>
        </p>
      </div>

      <Link
        href="/login"
        className="btn w-full border border-surface-line bg-white text-brand font-semibold hover:bg-surface-soft text-center"
      >
        ログインはこちら
      </Link>

      {/* 「仮会員登録完了」モーダル */}
      {sentTo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="仮会員登録完了"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-xl">
            <button
              type="button"
              onClick={() => setSentTo(null)}
              className="absolute right-4 top-4 text-ink-mute hover:text-ink"
              aria-label="閉じる"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <h2 className="text-center text-xl font-bold text-brand mb-4">仮会員登録完了</h2>
            <div className="text-center text-sm text-ink-soft leading-relaxed space-y-3">
              <p>
                <span className="font-semibold text-ink break-all">{sentTo}</span>
                <br />へメールを送信しました。
              </p>
              <p>登録メールが届かない場合は、迷惑メールフォルダをご確認ください。</p>
              <p>
                メールよりアカウント作成ページに進みいただき、
                <br />
                会員登録を続けてください。
              </p>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
