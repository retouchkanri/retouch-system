"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ROLES, ROLE_LABELS_JP, isStaffRole, toRole, type Role } from "@/lib/roles";

export default function LoginForm({ next }: { next: string }) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        setError("メールアドレスかパスワードが正しくありません。");
        return;
      }

      // Verify the selected permission level matches the account's actual role.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      const actual = toRole(profile?.role);
      if (actual !== role) {
        await supabase.auth.signOut();
        setError(
          `選択された権限が正しくありません。このアカウントの権限は「${ROLE_LABELS_JP[actual]}」です。正しい権限を選択してください。`,
        );
        return;
      }

      const dest = isStaffRole(actual) ? "/admin" : next;
      startTransition(() => {
        router.replace(dest);
        router.refresh();
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="role">権限</label>
        <select
          id="role"
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS_JP[r]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="email">メールアドレス</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="password">パスワード</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy || isPending}>
        {busy || isPending ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
