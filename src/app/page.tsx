import Image from "next/image";
import Link from "next/link";
import bgMobileImage from "@/assets/images/bg-m.png";
import bgDesktopImage from "@/assets/images/bg.png";
import bossImage from "@/assets/images/boss.png";
import contactBgImage from "@/assets/images/contact.png";
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
        <div aria-hidden className="absolute inset-0 z-10 bg-gradient-to-b from-black/25 via-black/10 to-black/55" />
        <div aria-hidden className="absolute inset-0 z-10 bg-gradient-to-r from-black/30 via-transparent to-transparent" />

        <div className="relative z-30 flex flex-1 items-end justify-center pb-8">
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
              <ul className="space-y-3 text-white/75 text-sm leading-relaxed">
                {[
                  "会員情報・支援口数を一元管理",
                  "支援状況や決済をリアルタイムで可視化",
                  "イベント申込・予約を簡単管理",
                  "スマホ・PCどちらでも使いやすい設計",
                  "決済失敗・要対応件数をダッシュボードで即確認",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-brand-light/30 flex items-center justify-center shrink-0">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="#95d5b2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/admin/login" className="mt-8 inline-flex items-center justify-center bg-brand-light text-brand-dark font-bold px-6 py-3 hover:brightness-105 transition text-base active:scale-[0.97]">
                管理者ログイン →
              </Link>
            </div>
            {/* Admin Dashboard Mockup */}
            <div className="overflow-hidden shadow-2xl border border-white/10">
              <div className="bg-gray-800 px-4 py-2.5 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" /><span className="w-3 h-3 rounded-full bg-yellow-400" /><span className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-gray-400 font-medium">管理者ダッシュボード — Retouch Admin</span>
              </div>
              <div className="flex" style={{ minHeight: 320 }}>
                <div className="w-36 bg-[#1b4332] text-white p-2 shrink-0 flex flex-col">
                  <p className="text-[10px] font-bold text-brand-light px-2 py-2 tracking-wider">Retouch</p>
                  {(["ダッシュボード","顧客一覧","支援管理","決済履歴","イベント管理","会員プラン","CSV出力"] as const).map((n, i) => (
                    <div key={n} className={`px-2 py-1.5 text-[10px] mb-0.5 ${i === 0 ? "bg-brand text-white font-bold" : "text-white/65"}`}>{n}</div>
                  ))}
                </div>
                <div className="flex-1 bg-gray-50 p-3 overflow-hidden">
                  <p className="text-[11px] font-bold text-gray-700 mb-2.5">ダッシュボード</p>
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {[{l:"会員数",v:"628人",s:"↑12 今月",c:"text-brand-dark"},{l:"継続契約",v:"56件",s:"有効中",c:"text-blue-600"},{l:"決済失敗",v:"3件",s:"要対応",c:"text-red-600"},{l:"月額収益",v:"¥3.2M",s:"↑8%",c:"text-brand-dark"}].map((k) => (
                      <div key={k.l} className="bg-white p-2 shadow-sm"><p className="text-[7px] text-gray-400 mb-0.5">{k.l}</p><p className={`text-xs font-bold ${k.c}`}>{k.v}</p><p className="text-[7px] text-gray-400 mt-0.5">{k.s}</p></div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    <div className="col-span-2 bg-white p-2 shadow-sm">
                      <p className="text-[8px] text-gray-500 font-semibold mb-1">月次収益推移（万円）</p>
                      <svg viewBox="0 0 120 42" className="w-full" preserveAspectRatio="none">
                        <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2d6a4f" stopOpacity="0.25" /><stop offset="100%" stopColor="#2d6a4f" stopOpacity="0.02" /></linearGradient></defs>
                        {[8,18,28,38].map((y) => (<line key={y} x1="0" y1={y} x2="120" y2={y} stroke="#e5e7eb" strokeWidth="0.5" />))}
                        <polygon points="0,36 20,30 40,24 60,26 80,16 100,10 120,6 120,42 0,42" fill="url(#cg)" />
                        <polyline points="0,36 20,30 40,24 60,26 80,16 100,10 120,6" fill="none" stroke="#2d6a4f" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                        {[[0,36],[20,30],[40,24],[60,26],[80,16],[100,10],[120,6]].map(([x,y])=>(<circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#2d6a4f" />))}
                      </svg>
                    </div>
                    <div className="bg-white p-2 shadow-sm flex flex-col items-center justify-center">
                      <p className="text-[8px] text-gray-500 font-semibold mb-1">契約状態</p>
                      <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#2d6a4f" strokeWidth="3" strokeDasharray="56 88" strokeDashoffset="0" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#95d5b2" strokeWidth="3" strokeDasharray="22 88" strokeDashoffset="-56" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#fca5a5" strokeWidth="3" strokeDasharray="7 88" strokeDashoffset="-78" />
                      </svg>
                      <div className="text-[7px] space-y-0.5 mt-1 w-full">
                        {[["#2d6a4f","有効 64%"],["#95d5b2","支援 25%"],["#fca5a5","失敗 8%"]].map(([c,l])=>(<div key={l} className="flex items-center gap-1"><span className="w-2 h-2 shrink-0" style={{background:c}} /><span className="text-gray-500">{l}</span></div>))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-2 shadow-sm">
                    <p className="text-[8px] text-gray-500 font-semibold mb-1">直近の決済</p>
                    {[["田中 一郎","月額会員","¥5,000",true],["鈴木 花子","馬匹支援","¥10,000",true],["佐藤 次郎","月額会員","¥3,000",false]].map(([n,t,a,ok])=>(
                      <div key={n as string} className="flex justify-between items-center text-[8px] py-1 border-b border-gray-100 last:border-0">
                        <span className="font-medium text-gray-700">{n as string}</span><span className="text-gray-400">{t as string}</span><span className="text-gray-700">{a as string}</span>
                        <span className={`px-1.5 py-0.5 font-bold ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{ok ? "成功" : "失敗"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── USER PAGE PREVIEW ── */}
      <section className="bg-surface-soft py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="overflow-hidden shadow-2xl border border-surface-line">
              <div className="bg-gray-800 px-4 py-2.5 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" /><span className="w-3 h-3 rounded-full bg-yellow-400" /><span className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-gray-400 font-medium">会員マイページ — Retouch Members</span>
              </div>
              <div className="bg-gray-50 p-4 space-y-3">
                <div className="bg-gradient-to-br from-brand to-brand-dark text-white p-4">
                  <p className="text-[10px] opacity-75 mb-0.5">こんにちは</p>
                  <p className="text-base font-bold">田中 一郎 様</p>
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {[["会員種別","一般会員"],["支援中","2頭"],["月額","¥8,000"],["予約","1件"]].map(([k,v])=>(
                      <div key={k}><p className="text-[9px] opacity-65">{k}</p><p className="text-[11px] font-bold mt-0.5">{v}</p></div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-3 shadow-sm">
                  <div className="grid grid-cols-2 gap-3">
                    {[["現在の会員種別","一般会員 A","text-brand-dark"],["お支払い状況","有効","text-green-700"],["次回決済日","2026-06-01","text-ink"],["月額支援合計","¥8,000","text-ink"]].map(([l,v,c])=>(
                      <div key={l as string}><p className="text-[8px] text-gray-400">{l as string}</p><p className={`text-xs font-bold ${c}`}>{v as string}</p></div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-3 shadow-sm">
                  <div className="flex justify-between items-center mb-2"><p className="text-[10px] font-bold text-gray-700">支援中の馬</p><span className="text-[9px] text-brand underline">新しい支援を追加</span></div>
                  {[["ハナミチ","1口 / ¥5,000/月","2023年生"],["ソラ","半口 / ¥3,000/月","2021年生"]].map(([n,d,y])=>(
                    <div key={n as string} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2"><span className="text-base">🐴</span><div><p className="text-[10px] font-bold text-gray-800">{n as string}</p><p className="text-[8px] text-gray-500">{d as string}　{y as string}</p></div></div>
                      <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 font-semibold">有効</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[["💰","単発寄付","一回限りの応援"],["📅","見学会予約","日程を選んで申込"]].map(([i,t,s])=>(
                    <div key={t as string} className="bg-white p-3 shadow-sm text-center hover:shadow-md transition cursor-pointer"><span className="text-xl">{i as string}</span><p className="text-[10px] font-bold text-gray-700 mt-1">{t as string}</p><p className="text-[8px] text-gray-400">{s as string}</p></div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <p className="text-brand font-bold tracking-[0.2em] text-xs sm:text-sm mb-3">MEMBER PAGE</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-5 leading-snug font-serif">会員は自分の支援を<br />いつでも確認・変更</h2>
              <ul className="space-y-3 text-ink-soft text-sm leading-relaxed">
                {[["🐴","支援中の馬と口数をひとつの画面で確認"],["📊","決済状況・次回請求日をリアルタイム表示"],["📅","見学会・個別見学の予約をオンラインで完結"],["💰","いつでも単発寄付が可能"],["✏️","住所・カード情報もセルフで変更できる"]].map(([ic,tx])=>(
                  <li key={tx as string} className="flex items-start gap-3"><span className="text-lg shrink-0 -mt-0.5">{ic as string}</span><span>{tx as string}</span></li>
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
      <section className="bg-white py-20 px-5">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-brand font-bold tracking-[0.2em] text-xs sm:text-sm mb-3">HOW IT WORKS</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-12 font-serif">3ステップで支援を始める</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: "01", title: "会員登録", body: "メールアドレスで簡単登録。入力は名前・住所など基本情報のみです。", icon: "📝" },
              { step: "02", title: "プラン選択", body: "一般会員・馬匹支援など、ご自身に合ったプランをお選びください。", icon: "🎯" },
              { step: "03", title: "支援スタート", body: "クレジットカードで安全に決済。いつでも変更・停止が可能です。", icon: "🚀" },
            ].map((s, i) => (
              <div key={s.step} className="relative flex flex-col items-center">
                {i < 2 && <div className="hidden sm:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-brand-100" />}
                <div className="w-16 h-16 bg-brand-50 flex items-center justify-center text-3xl mb-4">{s.icon}</div>
                <p className="text-xs font-bold text-brand tracking-widest mb-1">STEP {s.step}</p>
                <p className="text-lg font-bold text-ink mb-2">{s.title}</p>
                <p className="text-sm text-ink-soft leading-relaxed">{s.body}</p>
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
      <section className="relative bg-gradient-to-br from-brand-dark via-[#1a3f30] to-[#0f2b1e] py-20 px-5 overflow-hidden">
        <div aria-hidden className="absolute top-10 left-6 sm:left-16 text-brand-light/10 select-none">
          <svg width="80" height="64" viewBox="0 0 80 64" fill="currentColor"><path d="M0 40V24C0 10.7 10.7 0 24 0h4v12h-4C16.3 12 12 16.3 12 24v4h16v24H0zm44 0V24C44 10.7 54.7 0 68 0h4v12h-4C60.3 12 56 16.3 56 24v4h16v24H44z" /></svg>
        </div>

        <div className="relative max-w-5xl mx-auto">
          <p className="text-brand-light font-bold tracking-[0.2em] text-xs sm:text-sm mb-3 text-center">REVIEWS</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-10 text-center font-serif">お客様の声</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: "佐藤 美咲", role: "一般会員・3年目", rating: 5, text: "毎月の支援がどの馬に届いているか一目でわかるので安心です。見学会で実際に馬に会えたときは感動しました。" },
              { name: "田中 健太", role: "支援会員・1年目", rating: 5, text: "操作がシンプルで、50代の私でも迷わず使えました。決済の透明性が高く、信頼して支援を続けられます。" },
              { name: "鈴木 由美子", role: "一般会員・2年目", rating: 4, text: "以前は振込で大変でしたが、リニューアルでカード決済ができて格段に便利に。口数の変更もスムーズです。" },
              { name: "山田 太郎", role: "支援会員・4年目", rating: 5, text: "管理画面で支援状況が可視化されるので、スタッフとしても業務がスムーズになりました。" },
              { name: "中村 あゆみ", role: "一般会員・1年目", rating: 5, text: "友人に勧められて登録しました。登録もプラン選択も3分ほどで完了。単発寄付もしやすいです。" },
              { name: "高橋 誠", role: "支援会員・2年目", rating: 4, text: "見学会の予約がオンラインでできるようになり、家族で気軽に参加できるようになりました。" },
            ].map((r) => (
              <div key={r.name} className="bg-white/10 backdrop-blur-sm p-6 border border-white/10 hover:bg-white/15 transition">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-brand-light/30 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {r.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{r.name}</p>
                    <p className="text-white/50 text-xs">{r.role}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill={i < r.rating ? "#fbbf24" : "#4b5563"}>
                      <path d="M7 1l1.76 3.57 3.94.57-2.85 2.78.67 3.93L7 10.27l-3.52 1.58.67-3.93L1.3 5.14l3.94-.57L7 1z" />
                    </svg>
                  ))}
                </div>
                <p className="text-white/80 text-sm leading-relaxed">{r.text}</p>
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

        <div className="relative max-w-5xl mx-auto">
          <p className="text-brand font-bold tracking-[0.2em] text-xs sm:text-sm mb-3 text-center">CONTACT</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 text-center font-serif">お問い合わせ</h2>
          <p className="text-black text-sm max-w-lg mx-auto mb-12 text-center leading-relaxed">
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
