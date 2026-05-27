"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setAvatar(f);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(f ? URL.createObjectURL(f) : null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("fullName", fullName);
      fd.append("email", email);
      fd.append("password", password);
      if (avatar) fd.append("avatar", avatar);

      const res = await fetch("/api/auth/signup", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "登録に失敗しました。");
        return;
      }
      router.replace("/login?next=/mypage");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" encType="multipart/form-data">
      <div>
        <label className="label">プロフィール画像（任意）</label>
        <div className="flex items-center gap-3">
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarPreview}
              alt="プレビュー"
              className="w-16 h-16 rounded-full object-cover border border-surface-line"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-surface-soft border border-surface-line" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={onFile}
            className="text-sm"
          />
        </div>
      </div>
      <div>
        <label className="label">お名前</label>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div>
        <label className="label">メールアドレス</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label">パスワード（8文字以上）</label>
        <input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "登録中..." : "会員登録する"}
      </button>
      <p className="text-xs text-ink-mute">
        登録後、ログインページからログインしてください。
      </p>
    </form>
  );
}
