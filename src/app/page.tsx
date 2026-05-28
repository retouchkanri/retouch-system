import Image from "next/image";
import Link from "next/link";
import bgMobileImage from "@/assets/images/bg-m.png";
import bgDesktopImage from "@/assets/images/bg.png";
import bossImage from "@/assets/images/boss.png";
import contactBgImage from "@/assets/images/contact.png";
import reviewBgImage from "@/assets/images/review.png";
import adminImage from "@/assets/images/admin.png";
import userImage from "@/assets/images/user.png";
import BottomRightPanel from "@/components/BottomRightPanel";
import HomeHeroEffect from "@/components/HomeHeroEffect";
import BusinessPrinciplesDeck from "@/components/BusinessPrinciplesDeck";
import NewsCarousel from "@/components/NewsCarousel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { NewsItem } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: newsItems } = await supabase
    .from("news")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(12)
    .then((r) => r, () => ({ data: null }));

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HomeHeroEffect />

      {/* ── HERO ── */}
      <section className="relative isolate min-h-[calc(100vh-73px)] flex flex-col overflow-hidden">
        <Image
          src={bgMobileImage}
          alt="引退競走馬支援プロジェクト"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 z-0 object-cover object-center hero-zoom md:hidden"
        />
        <Image
          src={bgDesktopImage}
          alt="引退競走馬支援プロジェクト"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 z-0 hidden object-cover object-center hero-zoom md:block"
        />
        <div aria-hidden className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-black/20 to-black/65" />
        <div aria-hidden className="absolute inset-0 z-10 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

        {/* H1 — hero headline (primary SEO keyword target) */}
        <div className="relative z-30 flex flex-1 flex-col items-center justify-center text-center px-4 sm:px-5 pb-20 gap-4">
          <h1
            className="text-[clamp(1.45rem,5vw,3rem)] font-bold text-white font-serif leading-snug"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)" }}
          >
            引退競走馬と支援者をつなぐ<br />
            <span className="text-brand-light">Retouch</span>メンバーズサイト
          </h1>
          <p
            className="text-white/90 text-[clamp(0.8rem,2.5vw,1rem)] max-w-xl leading-relaxed"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
          >
            会員管理・支援馬管理・決済・寄付をひとつのプラットフォームで。<br className="hidden sm:block" />
            引退競走馬の安定した余生を、テクノロジーで支える仕組みです。
          </p>
        </div>

        <div className="relative z-30 flex items-end justify-center pb-8">
          <a href="#overview" aria-label="下へスクロール">
            <div className="hero-pulse w-12 h-12 rounded-full border-2 border-white/70 flex items-center justify-center hover:bg-white/15 transition-colors cursor-pointer">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v12M3 9l5 5 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </a>
        </div>
      </section>

      {/* ── OVERVIEW ── */}
      <section id="overview" className="bg-white py-20 px-5">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-brand font-bold tracking-[0.2em] text-xs sm:text-sm mb-3 font-sans">SYSTEM FEATURES</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-3 font-serif">
            引退競走馬支援を、<br className="sm:hidden" />もっとスマートに。
          </h2>
          <p className="text-ink-soft text-sm max-w-2xl mx-auto mb-4 leading-relaxed">
            会員管理から馬匹支援・決済・イベントまで、すべてひとつのシステムで完結します。<br />
            Retouchは、支援者・スタッフ・馬たちをつなぐ専用プラットフォームです。
          </p>
          <p className="text-ink-soft text-sm max-w-2xl mx-auto mb-12 leading-relaxed">
            紙の台帳や複数ツールの煩雑な管理から解放され、リアルタイムで支援状況を把握。
            会員の皆さまも、スマホひとつで支援・予約・決済をシームレスに行えます。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                img: "https://images.unsplash.com/photo-1565350897149-38dfafa81d83?w=600&h=300&fit=crop",
                title: "会員管理",
                desc: "会員情報・プラン・支払い状況を一元管理。CSVインポート・エクスポートにも対応し、既存データをそのまま移行できます。",
              },
              {
                img: "https://images.unsplash.com/photo-1694792651411-2412d8f235fb?w=600&h=300&fit=crop",
                title: "支援馬管理",
                desc: "馬ごとの支援口数・支援者・近況をリアルタイムで把握。写真・プロフィールの更新も管理画面から簡単に行えます。",
              },
              {
                img: "https://images.unsplash.com/photo-1556742031-c6961e8560b0?w=600&h=300&fit=crop",
                title: "決済管理",
                desc: "Stripe連携による安心・安全なサブスクリプション決済。決済失敗の自動検知・通知機能で取りこぼしをゼロに。",
              },
              {
                img: "https://images.unsplash.com/photo-1563830283-12f0a3ec7bf3?w=600&h=300&fit=crop",
                title: "イベント管理",
                desc: "牧場見学会・個別見学の定員管理・予約受付をオンライン化。参加者への自動確認メールも送信されます。",
              },
              {
                img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=300&fit=crop",
                title: "分析・レポート",
                desc: "月次収益・支援口数・会員推移をグラフで可視化。年次報告書の作成に必要なデータをワンクリックで出力できます。",
              },
              {
                img: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=600&h=300&fit=crop",
                title: "メッセージ",
                desc: "会員全体・特定プランへのお知らせ配信、個別サポートメール対応を一元化。大切な連絡を確実に届けます。",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex flex-col bg-white border border-surface-line hover:shadow-lg transition-shadow cursor-default overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.img} alt={f.title} className="w-full h-44 object-cover" />
                <div className="p-5 text-left">
                  <p className="font-bold text-base text-ink mb-2">{f.title}</p>
                  <p className="text-sm text-ink-soft leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUSINESS PRINCIPLES ── */}
      <section className="bg-surface-soft py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-brand font-bold tracking-[0.2em] text-xs sm:text-sm mb-3">BUSINESS PRINCIPLES</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-4 font-serif">事業方針</h2>
            <p className="text-ink-soft text-sm max-w-2xl mx-auto leading-relaxed">
              Retouch（リタッチ）は、引退競走馬の安定した余生を支えるため、
              テクノロジーと人のつながりを活かした持続可能な支援モデルを構築しています。
              以下の4つの方針を軸に、日々の運営・サービス開発を進めています。
            </p>
          </div>
          <BusinessPrinciplesDeck />
        </div>
      </section>

      {/* ── ADMIN PREVIEW ── */}
      <section className="bg-brand-dark py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-brand-light font-bold tracking-[0.2em] text-xs sm:text-sm mb-3">ADMIN DASHBOARD</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-5 leading-snug font-serif">
                管理者は全体を<br />ひと目で把握できる
              </h2>
              <ul className="space-y-3 text-white/80 text-sm leading-relaxed">
                {[
                  "会員情報・支援口数を一元管理",
                  "支援状況や決済をリアルタイムで可視化",
                  "イベント申込・予約を簡単管理",
                  "スマホ・PCどちらでも使いやすい設計",
                  "決済失敗・要対応件数をダッシュボードで即確認",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-brand-light/20 border border-brand-light/40 flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="#95d5b2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/admin/login" className="mt-8 inline-flex items-center justify-center bg-brand-light text-brand-dark font-bold px-6 py-3 hover:brightness-105 transition text-base active:scale-[0.97]">
                管理者ログイン →
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl shadow-2xl border border-white/10">
              <Image src={adminImage} alt="管理者ダッシュボード画面" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* ── USER PAGE PREVIEW ── */}
      <section className="bg-surface-soft py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="overflow-hidden rounded-xl shadow-2xl border border-surface-line">
              <Image src={userImage} alt="会員マイページ画面" className="w-full h-auto" />
            </div>
            <div>
              <p className="text-brand font-bold tracking-[0.2em] text-xs sm:text-sm mb-3">MEMBER PAGE</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-5 leading-snug font-serif">会員は自分の支援を<br />いつでも確認・変更</h2>
              <ul className="space-y-3 text-ink-soft text-sm leading-relaxed">
                {[
                  "支援中の馬と口数をひとつの画面で確認",
                  "決済状況・次回請求日をリアルタイム表示",
                  "見学会・個別見学の予約をオンラインで完結",
                  "いつでも単発寄付が可能",
                  "住所・カード情報もセルフで変更できる",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="btn-primary btn-pulse">会員登録する</Link>
                <Link href="/login" className="btn-secondary">ログイン</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-[#faf9f6] py-24 sm:py-28 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 sm:mb-20">
            <p className="text-brand-dark/60 font-bold tracking-[0.25em] text-[11px] mb-5">HOW IT WORKS</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink font-serif leading-relaxed">
              支援を始める、<br className="sm:hidden" />3つのステップ
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-y-14 sm:gap-y-0">
            {[
              { step: "01", title: "登録する", body: "お名前とご住所だけで、すぐに。" },
              { step: "02", title: "支え方を選ぶ", body: "あなたに合った形で、無理なく。" },
              { step: "03", title: "馬とつながる", body: "いつでも見守り、変えられます。" },
            ].map((s, i) => (
              <div key={s.step} className="relative px-6 sm:px-10 text-center">
                {i > 0 && (
                  <div aria-hidden className="hidden sm:block absolute left-0 top-3 bottom-3 w-px bg-ink/10" />
                )}
                <p className="font-serif text-4xl sm:text-5xl text-brand-dark/25 mb-6 leading-none">{s.step}</p>
                <h3 className="text-lg font-bold text-ink mb-4 font-serif tracking-wide">{s.title}</h3>
                <p className="text-sm text-ink-soft leading-loose">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEWS ── */}
      <section className="relative bg-surface-soft py-20 overflow-hidden">
        <div aria-hidden className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-brand-50 opacity-40 blur-3xl" />
        <div aria-hidden className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-brand-50 opacity-30 blur-3xl" />

        <div className="relative">
          <div className="px-5">
            <p className="text-brand font-bold tracking-[0.2em] text-xs sm:text-sm mb-3 text-center">NEWS</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-10 text-center font-serif">最新ニュース</h2>
          </div>
          <div className="px-5">
            <NewsCarousel items={(newsItems ?? []) as NewsItem[]} />
          </div>
        </div>
      </section>



      {/* ── CUSTOMER REVIEWS ── */}
      <section className="relative py-20 px-5 overflow-hidden">
        {/* Background image */}
        <Image src={reviewBgImage} alt="" fill className="object-cover object-center" />
        <div className="absolute inset-0 bg-white/15 backdrop-blur-[1px]" />

        <div aria-hidden className="absolute top-10 left-6 sm:left-16 text-brand-light/10 select-none">
          <svg width="80" height="64" viewBox="0 0 80 64" fill="currentColor"><path d="M0 40V24C0 10.7 10.7 0 24 0h4v12h-4C16.3 12 12 16.3 12 24v4h16v24H0zm44 0V24C44 10.7 54.7 0 68 0h4v12h-4C60.3 12 56 16.3 56 24v4h16v24H44z" /></svg>
        </div>

        {/* SVG defs for half-star gradient — rendered once, referenced by all cards */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="half-star-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#4b5563" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative max-w-5xl mx-auto">
          <p className="text-brand font-bold tracking-[0.2em] text-xs sm:text-sm mb-3 text-center">REVIEWS</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-10 text-center font-serif">お客様の声</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: "佐藤 美咲",  role: "一般会員・3年目",  rating: 5,   avatar: "https://images.unsplash.com/photo-1624091844772-554661d10173?w=100&h=100&fit=crop&crop=face", text: "毎月の支援がどの馬に届いているか一目でわかるので安心です。見学会で実際に馬に会えたときは感動しました。" },
              { name: "田中 健太",  role: "支援会員・1年目",  rating: 5,   avatar: "https://images.unsplash.com/photo-1630572780070-fce8b9e1e7e7?w=100&h=100&fit=crop&crop=face", text: "操作がシンプルで、50代の私でも迷わず使えました。決済の透明性が高く、信頼して支援を続けられます。" },
              { name: "鈴木 由美子", role: "一般会員・2年目", rating: 4.5, avatar: "https://images.unsplash.com/photo-1778291165732-bca4de5c3b07?w=100&h=100&fit=crop&crop=face", text: "以前は振込で大変でしたが、リニューアルでカード決済ができて格段に便利に。口数の変更もスムーズです。" },
              { name: "山田 太郎",  role: "支援会員・4年目",  rating: 5,   avatar: "https://images.unsplash.com/photo-1630572780329-e051273e980f?w=100&h=100&fit=crop&crop=face", text: "管理画面で支援状況が可視化されるので、スタッフとしても業務がスムーズになりました。" },
              { name: "中村 あゆみ", role: "一般会員・1年目", rating: 5,   avatar: "https://images.unsplash.com/photo-1624706477318-2b624c31e2e4?w=100&h=100&fit=crop&crop=face", text: "友人に勧められて登録しました。登録もプラン選択も3分ほどで完了。単発寄付もしやすいです。" },
              { name: "高橋 誠",   role: "支援会員・2年目",   rating: 4.5, avatar: "https://images.unsplash.com/photo-1701980889802-55ff39e2e973?w=100&h=100&fit=crop&crop=face", text: "見学会の予約がオンラインでできるようになり、家族で気軽に参加できるようになりました。" },
            ].map((r) => (
              <div key={r.name} className="bg-white/80 backdrop-blur-sm p-6 border border-white/60 hover:bg-white/90 transition shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.avatar}
                    alt={r.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-brand/30"
                  />
                  <div>
                    <p className="text-ink font-bold text-sm">{r.name}</p>
                    <p className="text-ink-soft text-xs">{r.role}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const filled = i < Math.floor(r.rating);
                    const half   = !filled && i < r.rating;
                    return (
                      <svg key={i} width="14" height="14" viewBox="0 0 14 14"
                        fill={filled ? "#fbbf24" : half ? "url(#half-star-grad)" : "#4b5563"}>
                        <path d="M7 1l1.76 3.57 3.94.57-2.85 2.78.67 3.93L7 10.27l-3.52 1.58.67-3.93L1.3 5.14l3.94-.57L7 1z" />
                      </svg>
                    );
                  })}
                </div>
                <p className="text-ink-soft text-sm leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="relative bg-surface-soft py-20 px-5 overflow-hidden">
        <div aria-hidden className="absolute top-0 right-0 w-64 h-64 opacity-[0.04]">
          <svg viewBox="0 0 200 200" fill="#2d6a4f"><text x="20" y="160" fontSize="180" fontWeight="bold">?</text></svg>
        </div>

        <div className="relative max-w-3xl mx-auto">
          <p className="text-brand font-bold tracking-[0.2em] text-xs sm:text-sm mb-3 text-center">FAQ</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-10 text-center font-serif">よくある質問</h2>

          <div className="space-y-3">
            {[
              { q: "入会金や年会費はかかりますか？", a: "入会金は無料です。月額会員プランは月額3,000円〜、馬匹支援は1口あたり月額5,000円〜となっております。いつでも変更・解約が可能です。" },
              { q: "支援する馬を選ぶことはできますか？", a: "はい。マイページから支援したい馬を一覧から選び、口数を指定して支援を開始できます。複数頭を同時に支援することも可能です。" },
              { q: "見学会には誰でも参加できますか？", a: "会員の方はどなたでもご参加いただけます。一般見学会は月1回、個別見学は支援会員限定で随時受付しております。ご家族・ご友人の同伴も可能です。" },
              { q: "支払い方法は何がありますか？", a: "クレジットカード（Visa / Mastercard / JCB / AMEX）に対応しています。Stripe社のセキュアな決済基盤を利用しており、カード情報は当サイトには保存されません。" },
              { q: "退会・解約はいつでもできますか？", a: "はい。マイページからいつでもプラン変更・解約が可能です。解約後も当月末までは会員特典をご利用いただけます。" },
              { q: "寄付金は何に使われますか？", a: "いただいたご支援は、馬の飼料・蹄鉄・獣医療費・牧場運営費・スタッフ人件費に充てられます。年次報告書で詳細な使途を公開しています。" },
            ].map((item) => (
              <details key={item.q} className="group bg-white shadow-sm overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 font-bold text-sm text-ink cursor-pointer hover:bg-brand-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 bg-brand-50 text-brand flex items-center justify-center text-xs font-bold shrink-0">Q</span>
                    <span>{item.q}</span>
                  </div>
                  <svg className="faq-chevron w-5 h-5 shrink-0 text-ink-mute" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </summary>
                <div className="px-5 pb-5 pt-0">
                  <div className="pl-10 text-sm text-ink-soft leading-relaxed border-t border-surface-line pt-4">{item.a}</div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>


      {/* ── CONTACT ── */}
      <section className="relative py-20 px-5 overflow-hidden">
        {/* Background image */}
        <Image
          src={contactBgImage}
          alt=""
          fill
          className="object-cover"
          priority={false}
        />
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative max-w-5xl mx-auto">
          <p className="text-brand-light font-bold tracking-[0.2em] text-xs sm:text-sm mb-3 text-center drop-shadow-md">CONTACT</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 text-center font-serif drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">お問い合わせ</h2>
          <p className="text-white text-sm max-w-lg mx-auto mb-12 text-center leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
            ご不明な点がございましたら、お気軽にお問い合わせください。
          </p>

          {/* Contact form */}
          <div className="max-w-2xl mx-auto shadow-card border border-brand/20 p-6 sm:p-8">
            <h3 className="font-bold text-lg text-brand-dark mb-5 flex items-center gap-2">
              <svg viewBox="0 0 20 20" className="w-5 h-5" fill="#2d6a4f"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
              お問い合わせフォーム
            </h3>
            <form className="space-y-4" action="#">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">お名前</label>
                  <input type="text" className="input" placeholder="山田 太郎" />
                </div>
                <div>
                  <label className="label">メールアドレス</label>
                  <input type="email" className="input" placeholder="email@example.com" />
                </div>
              </div>
              <div>
                <label className="label">件名</label>
                <input type="text" className="input" placeholder="お問い合わせ内容の件名" />
              </div>
              <div>
                <label className="label">メッセージ</label>
                <textarea className="input min-h-[120px] resize-y" placeholder="お問い合わせ内容をご記入ください" />
              </div>
              <button type="submit" className="btn-primary w-full sm:w-auto btn-pulse">
                送信する
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink py-10 text-center">
        <p className="font-brand text-brand-light text-xl mb-2">Retouch</p>
        <p className="text-white/40 text-xs">© 2026 引退競走馬支援プロジェクト</p>
      </footer>

      {/* Bottom padding for mobile CTA bar */}
      <div className="h-16 md:hidden" />

      <BottomRightPanel />
    </div>
  );
}
