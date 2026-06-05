import Image from "next/image";
import Link from "next/link";
import bgMobileImage from "@/assets/images/bg-m.png";
import bgDesktopImage from "@/assets/images/bg.png";
import bossImage from "@/assets/images/boss.png";
import contactBgImage from "@/assets/images/contact.png";
import userImage from "@/assets/images/user.png";
import ponyImage from "@/assets/images/pony.png";
import featureMembersImage from "@/assets/images/feature-members.jpg";
import featureEventImage from "@/assets/images/feature-event.jpg";
import featureHorseImage from "@/assets/images/feature-horse.jpg";
import BottomRightPanel from "@/components/BottomRightPanel";
import HomeHeroEffect from "@/components/HomeHeroEffect";
import HeroText from "@/components/HeroText";
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
    <div className="flex flex-col min-h-0 flex-1 overflow-x-hidden max-w-full">
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
        {/* H1 — hero headline (primary SEO keyword target).
            背景画像は元の色のまま表示するため、暗いオーバーレイは外しています。
            可読性は各テキストの drop-shadow で確保。 */}
        <HeroText />

        <div className="relative z-30 flex items-end justify-center pb-8">
          <a href="#overview" aria-label="下へスクロール">
            <div className="hero-pulse w-12 h-12 rounded-full border-2 border-white/70 flex items-center justify-center hover:bg-white/15 transition-colors cursor-pointer">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v12M3 9l5 5 5-5" stroke="#2d6a4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
            人と馬をつなぐ<br className="sm:hidden" />Retouch専用プラットフォーム
          </h2>
          <p className="text-[13px] sm:text-sm max-w-2xl mx-auto mb-4 leading-relaxed text-ink-soft">
            <span className="block whitespace-nowrap">ここから始まる、人と馬が支え合う未来。</span>
            <span className="block whitespace-nowrap">Retouchメンバー様の力で、馬たちに新たな役割を。</span>
          </p>
          <p className="text-ink-soft text-sm max-w-2xl mx-auto mb-12 leading-relaxed">
            Retouchは、支援者・スタッフ・馬たちをつなぎ、
            人と馬が支え合う未来を育むためのプラットフォームです。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                img: featureMembersImage.src,
                title: "会員様情報",
                desc: "会員情報や契約プラン、支援履歴を一元管理。いつでもご自身の支援状況を確認できます。",
              },
              {
                img: featureHorseImage.src,
                title: "支援馬管理",
                desc: "支援している馬や口数、支援履歴をわかりやすく表示。応援している馬たちの近況も簡単に確認できます。",
              },
              {
                img: "https://images.unsplash.com/photo-1556742031-c6961e8560b0?w=600&h=300&fit=crop",
                title: "決済管理",
                desc: "クレジットカード決済やサブスクリプション管理を安全・スムーズに。登録内容の変更も簡単に行えます。",
              },
              {
                img: featureEventImage.src,
                title: "イベント管理",
                desc: "見学会や馬とのふれあいイベントの申込みをアプリから簡単予約。参加履歴もまとめて確認できます。",
              },
              {
                img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=300&fit=crop",
                title: "分析・レポート",
                desc: "支援状況や資金の活用状況を見える化。皆様の支援がどのように馬たちの未来につながっているかをご確認いただけます。",
              },
              {
                img: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=600&h=300&fit=crop",
                title: "お知らせ・メッセージ",
                desc: "Retouchからの活動報告や重要なお知らせをリアルタイムで配信。大切な情報を確実にお届けします。",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex flex-col bg-white border border-surface-line rounded-xl hover:shadow-lg transition-shadow cursor-default overflow-hidden"
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
              Retouch（リタッチ）は、引退競走馬に新たな役割と活躍の場を創出し、
              人と馬が支え合う社会の実現を目指しています。<br />
              そのために、テクノロジーと人とのつながりを活かした持続可能な支援の仕組みを構築し、
              以下の4つの方針を軸に事業を推進しています。
            </p>
          </div>
          <BusinessPrinciplesDeck />
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
              <div className="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
                <Link href="/signup" className="btn-primary btn-pulse">会員登録する</Link>
                <Link href="/login" className="btn-secondary">ログイン</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── RETOUCH PONY TEAM ── */}
      <section id="pony-team" className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-amber-50/50 py-20 px-5">
        <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-100/40 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 -left-16 w-64 h-64 rounded-full bg-amber-100/40 blur-3xl" />

        <div className="relative max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* Photo with price badge */}
            <div className="relative order-1">
              <div className="overflow-hidden rounded-2xl shadow-2xl border border-white/70">
                <Image
                  src={ponyImage}
                  alt="ふれあい活動を行うRetouchポニーチームのポニーたち"
                  className="w-full h-[280px] sm:h-[380px] object-cover"
                />
              </div>
              <div className="absolute -bottom-5 right-4 sm:right-8 bg-white rounded-2xl shadow-xl px-5 py-3 border border-brand-100 text-center">
                <p className="text-[11px] text-ink-mute font-bold tracking-wider">月額支援</p>
                <p className="font-serif text-2xl sm:text-3xl font-bold text-brand-dark leading-none mt-0.5">
                  ¥3,000<span className="text-sm font-sans font-medium text-ink-soft"> / 月</span>
                </p>
              </div>
            </div>

            {/* Copy */}
            <div className="order-2">
              <p className="text-brand font-bold tracking-[0.2em] text-xs sm:text-sm mb-3">RETOUCH PONY TEAM</p>
              <h2 className="text-2xl sm:text-[1.9rem] font-bold text-ink mb-5 leading-snug font-serif">
                肥育場からやってきたポニーたちを、<br className="hidden sm:block" />みんなで支えませんか？
              </h2>
              <p className="text-ink-soft text-sm leading-relaxed mb-4">
                この子たちは、ただ保護されるだけの存在ではありません。イベントやふれあい活動を通じて、引退競走馬や肥育場にいる馬たちの現状を伝える、Retouchの大切な
                <span className="font-bold text-brand-dark">「広報部隊」</span>です。
              </p>
              <p className="text-ink font-serif text-base sm:text-lg font-bold mb-5 leading-relaxed">
                小さな体で、大きな役割を担うポニーたち。
              </p>
              <p className="text-ink-soft text-sm leading-relaxed mb-6">
                その毎日と未来を支えるため、月額3,000円の
                <span className="font-bold text-brand-dark">「Retouchポニーチーム支援メンバー」</span>
                を募集しています。あなたのご支援が、ポニーたちの暮らしを支え、そして多くの馬たちの未来につながります。
              </p>

              <p className="text-xs font-bold text-ink-mute tracking-wide mb-2">ご支援の使いみち</p>
              <ul className="flex flex-wrap gap-2 mb-7">
                {["飼育費", "医療費", "輸送・移動費", "イベント・広報活動費", "施設維持管理費"].map((t) => (
                  <li
                    key={t}
                    className="inline-flex items-center gap-1.5 bg-white/85 border border-brand-100 text-brand-dark text-xs font-bold px-3 py-1.5 rounded-full shadow-sm"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                      <path d="M2 5l2.5 2.5 3.5-4" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t}
                  </li>
                ))}
              </ul>

              {/* Mobile: stacked, centered, equal-width buttons. Desktop: inline row. */}
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link href="/donate" className="btn-primary btn-pulse w-full max-w-xs sm:w-auto sm:max-w-none">ポニーチームを支援する</Link>
                <Link href="#contact" className="btn-secondary w-full max-w-xs sm:w-auto sm:max-w-none">活動について相談する</Link>
              </div>
              <p className="text-xs text-ink-mute mt-3 text-center sm:text-left">※ 他の会員プランと併用してご参加いただけます。</p>
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
              { q: "Retouchとはどのような活動をしていますか？", a: "引退競走馬や肥育場にいる馬たちに新たな役割や活躍の場をつくり、人と馬が支え合う社会の実現を目指しています。" },
              { q: "なぜ馬を保護しているのですか？", a: "引退後の進路が見つからず、肥育場へ向かう馬たちがいます。Retouchでは、そのような馬たちに新しい役割や活躍の場をつくり、第二の人生を支える活動を行っています。" },
              { q: "肥育場とは何ですか？", a: "肥育場とは、食肉用として出荷される前の馬が集められる施設です。Retouchでは、その中から新たな未来をつくれる可能性のある馬たちを受け入れています。" },
              { q: "保護された馬たちはその後どうなりますか？", a: "乗馬、教育活動、観光、セラピー、ふれあい活動など、それぞれの個性に合った新しい役割を見つけ、人と関わりながら暮らしています。" },
              { q: "会員になるにはどうすればよいですか？", a: "会員登録ページよりお申し込みいただけます。スマートフォンやパソコンから簡単にお手続きいただけます。" },
              { q: "支援する馬は選べますか？", a: "はい。一口・半口支援では応援したい馬を選んでご支援いただけます。" },
              { q: "複数の馬を支援できますか？", a: "はい。複数頭への支援や追加支援も可能です。" },
              { q: "支援金はどのように使われますか？", a: "馬たちの飼育費、医療費、輸送費、施設維持費、教育活動費などに活用しています。" },
              { q: "支援した馬に会うことはできますか？", a: "はい。見学会や交流イベントを定期的に開催しております。詳細は会員ページやお知らせをご確認ください。" },
              { q: "馬たちの近況は知ることができますか？", a: "会員ページや活動報告、動画配信などを通じて定期的にお知らせしています。" },
              { q: "見学会やイベントには参加できますか？", a: "はい。会員向けイベントや一般参加可能なイベントを開催しております。アプリや会員ページからお申し込みいただけます。" },
              { q: "支援内容の変更や追加はできますか？", a: "はい。マイページから支援内容の確認・変更・追加支援のお手続きが可能です。" },
              { q: "支援を停止・退会したい場合はどうすればよいですか？", a: "マイページまたはお問い合わせフォームよりお手続きいただけます。" },
              { q: "企業や団体として支援することはできますか？", a: "はい。企業・団体様からのご支援や協賛も受け付けております。お気軽にお問い合わせください。" },
              { q: "ボランティアとして参加できますか？", a: "イベント運営や環境整備など、活動内容に応じて募集を行っています。募集情報はお知らせページをご確認ください。" },
              { q: "Retouchの目指す未来は何ですか？", a: "馬を「救う」だけでなく、一頭一頭に新たな役割をつくり、人と馬が支え合う社会を実現することです。皆様のご支援が、その未来を支える大きな力になっています。" },
            ].map((item) => (
              <details key={item.q} className="group bg-white shadow-sm rounded-xl overflow-hidden">
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
      <section id="contact" className="relative py-20 px-5 overflow-hidden">
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
          <div className="card max-w-2xl mx-auto bg-white">
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
        <p className="font-serif text-brand-light text-xl mb-2">Retouch</p>
        <p className="text-white/40 text-xs">© 2026 引退競走馬支援プロジェクト</p>
      </footer>

      {/* Bottom padding for mobile CTA bar + floating controls */}
      <div className="h-20 md:hidden" aria-hidden />

      <BottomRightPanel />
    </div>
  );
}
