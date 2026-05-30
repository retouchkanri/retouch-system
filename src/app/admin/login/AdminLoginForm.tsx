"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ROLES, ROLE_LABELS_JP, isStaffRole, toRole, type Role } from "@/lib/roles";

export default function AdminLoginForm() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        setError("メールアドレスかパスワードが正しくありません。");
        return;
      }
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
      router.replace(isStaffRole(actual) ? "/admin" : "/mypage");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">権限</label>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS_JP[r]}
            </option>
          ))}
        </select>
      </div>
      <div><label className="label">メール</label><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div><label className="label">パスワード</label><input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      {error && <p className="text-danger text-sm">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "確認中..." : "ログイン"}</button>
    </form>
  );
}
