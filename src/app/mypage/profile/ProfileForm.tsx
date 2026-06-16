"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@/types/db";

export default function ProfileForm({
  customer,
  email,
  avatarUrl,
}: {
  customer: Customer;
  email: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: customer.full_name ?? "",
    full_name_kana: customer.full_name_kana ?? "",
    phone: customer.phone ?? "",
    postal_code: customer.postal_code ?? "",
    address1: customer.address1 ?? "",
    address2: customer.address2 ?? "",
    birthday: customer.birthday ?? "",
    gender: customer.gender ?? "unspecified",
  });
  const [emailVal, setEmailVal] = useState(email);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
  };

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErr("画像は5MB以内にしてください");
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setMsg(null);

    if (newPassword && newPassword !== confirmPassword) {
      setErr("パスワードが一致しません。");
      setSaving(false);
      return;
    }

    // 1) Upload avatar if changed
    if (avatarFile) {
      const fd = new FormData();
      fd.append("avatar", avatarFile);
      const res = await fetch("/api/mypage/avatar", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? "アバターのアップロードに失敗しました。");
        setSaving(false);
        return;
      }
    }

    // 2) Update profile fields
    const res = await fetch("/api/mypage/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "プロフィールの保存に失敗しました。");
      setSaving(false);
      return;
    }

    // 3) Update email/password if changed
    const emailChanged = emailVal !== email;
    const passwordChanged = newPassword.length >= 8;
    if (emailChanged || passwordChanged) {
      const payload: Record<string, string> = {};
      if (emailChanged) payload.email = emailVal;
      if (passwordChanged) payload.newPassword = newPassword;
      const res2 = await fetch("/api/mypage/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res2.ok) {
        const j = await res2.json().catch(() => ({}));
        setErr(j.error ?? "アカウント情報の更新に失敗しました。");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setMsg("変更内容を保存しました。");
    setNewPassword("");
    setConfirmPassword("");
    setAvatarFile(null);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Avatar section */}
      <div className="card">
        <h2 className="text-base font-bold mb-4">プロフィール写真</h2>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative group shrink-0"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="w-20 h-20 rounded-full object-cover border-2 border-surface-line group-hover:border-brand transition-colors"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-surface-soft border-2 border-surface-line group-hover:border-brand transition-colors flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-mute">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
          </button>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-brand underline text-sm font-medium"
            >
              写真を変更する
            </button>
            <p className="text-xs text-ink-mute mt-1">JPEG, PNG, WEBP, GIF（5MB以内）</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onAvatarChange}
          />
        </div>
      </div>

      {/* Basic info */}
      <div className="card space-y-4">
        <h2 className="text-base font-bold">基本情報</h2>
        <div>
          <label className="label">お名前</label>
          <input className="input" value={form.full_name} onChange={set("full_name")} required />
        </div>
        <div>
          <label className="label">ニックネーム（表示されることがあります）</label>
          <input className="input" value={form.full_name_kana} onChange={set("full_name_kana")} />
        </div>
        <div>
          <label className="label">電話番号</label>
          <input className="input" value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="label">郵便番号</label>
          <input className="input" value={form.postal_code} onChange={set("postal_code")} />
        </div>
        <div>
          <label className="label">住所</label>
          <input className="input mb-2" placeholder="都道府県・市区町村・番地" value={form.address1} onChange={set("address1")} />
          <input className="input" placeholder="建物名・部屋番号など" value={form.address2} onChange={set("address2")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">生年月日</label>
            <input type="date" className="input" value={form.birthday} onChange={set("birthday")} />
          </div>
          <div>
            <label className="label">性別</label>
            <select className="input" value={form.gender} onChange={set("gender")}>
              <option value="unspecified">未回答</option>
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </select>
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="card space-y-4">
        <h2 className="text-base font-bold">メールアドレス</h2>
        <div>
          <label className="label">メールアドレス</label>
          <input
            type="email"
            className="input"
            value={emailVal}
            onChange={(e) => setEmailVal(e.target.value)}
            required
          />
          {emailVal !== email && (
            <p className="text-xs text-amber-600 mt-1">メールアドレスが変更されます。</p>
          )}
        </div>
      </div>

      {/* Password */}
      <div className="card space-y-4">
        <h2 className="text-base font-bold">パスワード変更</h2>
        <p className="text-xs text-ink-mute">変更する場合のみ入力してください。</p>
        <div>
          <label className="label">新しいパスワード（8文字以上）</label>
          <input
            type="password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            placeholder="新しいパスワードを入力"
          />
        </div>
        <div>
          <label className="label">パスワード確認</label>
          <input
            type="password"
            className="input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            placeholder="もう一度入力してください"
          />
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-danger mt-1">パスワードが一致しません。</p>
          )}
        </div>
      </div>

      {msg && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200">
          <p className="text-ok text-sm font-semibold">{msg}</p>
        </div>
      )}
      {err && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-danger text-sm font-semibold">{err}</p>
        </div>
      )}

      <button className="btn-primary w-full" disabled={saving}>
        {saving ? "保存中..." : "変更内容を保存する"}
      </button>
    </form>
  );
}
