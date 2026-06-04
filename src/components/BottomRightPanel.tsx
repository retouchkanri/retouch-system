"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import doImage from "@/assets/images/do.png";

type Message = { from: "bot" | "user"; text: string };

const INITIAL_MESSAGES: Message[] = [
  { from: "bot", text: "こんにちは！Retouchサポートです。引退競走馬支援についてお気軽にご質問ください。" },
];

function getBotReply(input: string): string {
  const t = input.trim().toLowerCase();
  if (/会員|登録|入会/.test(t))
    return "会員登録は無料です。トップページの「無料で会員登録する」ボタンからお手続きいただけます。";
  if (/寄付|支援|donation/.test(t))
    return "単発寄付は /donate ページから、月次サポートは会員登録後のマイページからお手続きいただけます。";
  if (/退会|解約|キャンセル/.test(t))
    return "退会はマイページ > アカウント設定からいつでも手続きできます。";
  if (/馬|horse/.test(t))
    return "現在支援している馬の情報はマイページでご確認いただけます。詳しくは support@retouch-members.com までどうぞ。";
  if (/料金|プラン|fee|price/.test(t))
    return "月次サポートプランは複数ご用意しています。会員登録後のマイページでプランをご選択いただけます。";
  if (/問い合わせ|連絡|contact/.test(t))
    return "お問い合わせは support@retouch-members.com または お問い合わせフォームからお送りください。営業日24時間以内にご返信します。";
  if (/ありがとう|thank/.test(t))
    return "こちらこそ、引退競走馬への温かいご支援ありがとうございます！";
  return "ご質問ありがとうございます。さらに詳しい内容は support@retouch-members.com までお問い合わせいただくか、お問い合わせフォームをご利用ください。";
}

export default function BottomRightPanel({
  showDonate = true,
  showChat = true,
}: {
  /** 単発寄付ボタン（左下の画像）を表示するか。 */
  showDonate?: boolean;
  /** チャットサポートボタンを表示するか。 */
  showChat?: boolean;
} = {}) {
  const [showTop, setShowTop] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { from: "user", text }]);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { from: "bot", text: getBotReply(text) }]);
    }, 900);
  }

  return (
    <>
      {/* ── Donation image — bottom-left (consistent inset on every device) ── */}
      {showDonate && (
        <a
          href="/donate"
          className="fixed bottom-0 left-0 z-40 block w-[min(7.5rem,28vw)] transition-transform duration-300 hover:scale-110 focus-visible:scale-110 focus:outline-none drop-shadow-xl sm:w-44 md:w-[22.5rem] md:max-w-[min(22.5rem,40vw)]"
          aria-label="単発寄付をする"
        >
          <Image
            src={doImage}
            alt="単発寄付をする"
            width={780}
            height={780}
            className="w-full h-auto object-contain"
          />
        </a>
      )}

      {/* ── Fixed bottom-right stack — same inset on PC / tablet / mobile ── */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">

        {/* Chatbot button */}
        {showChat && (
          <div className="relative flex items-center justify-center">
            {/* Ping rings — only when chat is closed */}
            {!chatOpen && (
              <>
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand opacity-40 animate-ping" />
                <span className="absolute inline-flex h-[140%] w-[140%] rounded-full bg-brand opacity-20 animate-[ping_1.8s_cubic-bezier(0,0,0.2,1)_infinite_0.4s]" />
              </>
            )}
            <button
              onClick={() => setChatOpen((v) => !v)}
              className="relative w-12 h-12 rounded-full bg-brand text-white shadow-lg flex items-center justify-center hover:bg-brand-dark hover:scale-110 active:scale-95 transition-all duration-200"
              aria-label="チャットサポートを開く"
            >
              {chatOpen ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 3l12 12M15 3L3 15" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Top button */}
        {showTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="scroll-top-btn w-12 h-12 rounded-full bg-brand text-white shadow-lg flex items-center justify-center hover:bg-brand-dark transition-colors"
            aria-label="ページトップへ"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3M3 8l5-5 5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Chat popup ── */}
      {showChat && chatOpen && (
        <div className="fixed bottom-36 right-4 z-50 w-[min(20rem,calc(100vw-1.5rem))] sm:w-96 flex flex-col bg-white rounded-2xl shadow-2xl border border-surface-line overflow-hidden animate-[scaleIn_200ms_ease]">
          {/* Header */}
          <div className="bg-brand px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-none">Retouchサポート</p>
              <p className="text-white/70 text-xs mt-0.5">自動返答チャット</p>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="閉じる"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-72 bg-surface-soft">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                {m.from === "bot" && (
                  <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    m.from === "user"
                      ? "bg-brand text-white rounded-br-sm"
                      : "bg-white text-ink shadow-sm rounded-bl-sm border border-surface-line"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="bg-white text-ink shadow-sm border border-surface-line px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-brand/50 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-brand/50 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-brand/50 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested quick replies */}
          <div className="px-3 py-2 flex gap-2 flex-wrap bg-white border-t border-surface-line">
            {["会員登録", "寄付について", "退会方法"].map((q) => (
              <button
                key={q}
                onClick={() => {
                  setInput(q);
                  setTimeout(() => {
                    setMessages((prev) => [...prev, { from: "user", text: q }]);
                    setInput("");
                    setIsTyping(true);
                    setTimeout(() => {
                      setIsTyping(false);
                      setMessages((prev) => [...prev, { from: "bot", text: getBotReply(q) }]);
                    }, 900);
                  }, 0);
                }}
                className="text-xs px-2 py-1 border border-brand/30 text-brand rounded-full hover:bg-brand/5 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 flex gap-2 bg-white border-t border-surface-line">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="メッセージを入力..."
              className="flex-1 text-sm border border-surface-line rounded-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-brand-dark transition-colors"
              aria-label="送信"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
