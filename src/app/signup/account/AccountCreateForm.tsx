"use client";

import Link from "next/link";
import { useState } from "react";
import { PREFECTURES } from "@/lib/jpAddress";

type Gender = "male" | "female" | "unspecified";

export default function AccountCreateForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const nowYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => nowYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const [form, setForm] = useState({
    username: "",
    last_name: "",
    first_name: "",
    last_name_kana: "",
    first_name_kana: "",
    phone: "",
    postal_code: "",
    prefecture: "",
    address_city: "",
    address_town: "",
    address_building: "",
  });
  const [gender, setGender] = useState<Gender>("male");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [newsletterReceive, setNewsletterReceive] = useState(true);
  const [announcementReceive, setAnnouncementReceive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const birthday =
      birthYear && birthMonth && birthDay
        ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`
        : "";

    setLoading(true);
    try {
      const res = await fetch("/api/auth/registration/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          ...form,
          gender,
          birthday,
          newsletter_opt_out: !newsletterReceive,
          announcement_opt_out: !announcementReceive,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "登録に失敗しました。");
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center space-y-4 py-4">
        <p className="text-3xl">🎉</p>
        <h1 className="text-xl font-bold">会員登録が完了しました</h1>
        <p className="text-sm text-ink-soft leading-relaxed">
          ご登録ありがとうございます。
          <br />
          登録したメールアドレスとパスワードでログインいただけます。
        </p>
        <Link href="/login" className="btn-primary inline-flex">
          ログインする
        </Link>
      </div>
    );
  }

  const Req = () => <span className="text-danger text-xs ml-1">必須</span>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-center text-xl font-bold text-brand">アカウント作成</h1>
      <p className="text-center text-xs text-ink-mute -mt-1">
        会員情報をご入力ください。
      </p>

      <div>
        <label className="label">
          ユーザーネーム<Req />
        </label>
        <input className="input" value={form.username} onChange={set("username")} required maxLength={60} />
      </div>

      <div>
        <label className="label">メールアドレス</label>
        <input className="input bg-surface-soft" value={email} readOnly />
      </div>

      <div>
        <label className="label">
          氏名<Req />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="名字" value={form.last_name} onChange={set("last_name")} required maxLength={60} />
          <input className="input" placeholder="名前" value={form.first_name} onChange={set("first_name")} required maxLength={60} />
        </div>
      </div>

      <div>
        <label className="label">
          氏名（カナ）<Req />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="セイ" value={form.last_name_kana} onChange={set("last_name_kana")} required maxLength={60} />
          <input className="input" placeholder="メイ" value={form.first_name_kana} onChange={set("first_name_kana")} required maxLength={60} />
        </div>
      </div>

      <div>
        <label className="label">
          電話番号（非公開）<Req />
        </label>
        <input className="input" type="tel" placeholder="03-0000-0000" value={form.phone} onChange={set("phone")} required maxLength={40} />
      </div>

      <div>
        <label className="label">
          住所（非公開）<Req />
        </label>
        <div className="space-y-2">
          <input className="input" placeholder="郵便番号" value={form.postal_code} onChange={set("postal_code")} required maxLength={20} />
          <select className="input" value={form.prefecture} onChange={set("prefecture")} required>
            <option value="">都道府県</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input className="input" placeholder="市区町村" value={form.address_city} onChange={set("address_city")} required maxLength={100} />
          <input className="input" placeholder="町名・番地" value={form.address_town} onChange={set("address_town")} required maxLength={100} />
          <input className="input" placeholder="建物名・部屋番号など（任意）" value={form.address_building} onChange={set("address_building")} maxLength={200} />
        </div>
      </div>

      <div>
        <label className="label">性別</label>
        <div className="flex items-center gap-4 text-sm">
          {([
            ["male", "男性"],
            ["female", "女性"],
            ["unspecified", "選択しない"],
          ] as [Gender, string][]).map(([val, lbl]) => (
            <label key={val} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="gender"
                checked={gender === val}
                onChange={() => setGender(val)}
                className="text-brand focus:ring-brand/30"
              />
              <span>{lbl}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label">生年月日</label>
        <div className="flex items-center gap-2">
          <select className="input" value={birthYear} onChange={(e) => setBirthYear(e.target.value)}>
            <option value="">年</option>
            {years.map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
          <span className="text-sm text-ink-soft">年</span>
          <select className="input" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)}>
            <option value="">月</option>
            {months.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
          <span className="text-sm text-ink-soft">月</span>
          <select className="input" value={birthDay} onChange={(e) => setBirthDay(e.target.value)}>
            <option value="">日</option>
            {days.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
          <span className="text-sm text-ink-soft">日</span>
        </div>
      </div>

      <div>
        <label className="label">メールマガジン</label>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="newsletter" checked={newsletterReceive} onChange={() => setNewsletterReceive(true)} className="text-brand focus:ring-brand/30" />
            <span>受信する</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="newsletter" checked={!newsletterReceive} onChange={() => setNewsletterReceive(false)} className="text-brand focus:ring-brand/30" />
            <span>受信しない</span>
          </label>
        </div>
        <p className="text-xs text-ink-mute mt-1">
          広告を含んだメールマガジンの配信に同意いただける場合は「受信する」を選択してください。
        </p>
      </div>

      <div>
        <label className="label">お知らせ通知</label>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="announcement" checked={announcementReceive} onChange={() => setAnnouncementReceive(true)} className="text-brand focus:ring-brand/30" />
            <span>通知する</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="announcement" checked={!announcementReceive} onChange={() => setAnnouncementReceive(false)} className="text-brand focus:ring-brand/30" />
            <span>通知しない</span>
          </label>
        </div>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button className="btn-primary w-full" type="submit" disabled={loading}>
        {loading ? "登録中..." : "次へ（登録を完了する）"}
      </button>
    </form>
  );
}
