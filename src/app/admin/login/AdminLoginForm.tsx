"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function AdminLoginForm() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError("ログインに失敗しました");
      return;
    }
    router.replace("/admin");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label">メール</label><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div><label className="label">パスワード</label><input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      {error && <p className="text-danger text-sm">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "確認中..." : "ログイン"}</button>
    </form>
  );
}
