import Image from "next/image";
import loginLogo from "@/assets/images/loginlogo.png";

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 my-5" aria-hidden="true">
      <div className="flex-1 border-t border-surface-line" />
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-brand shrink-0">
        <circle cx="8" cy="10" r="2.5" fill="currentColor" />
        <circle cx="16" cy="10" r="2.5" fill="currentColor" />
        <circle cx="12" cy="14" r="2.5" fill="currentColor" />
      </svg>
      <div className="flex-1 border-t border-surface-line" />
    </div>
  );
}

export default function AuthModalHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-3">
        <Image
          src={loginLogo}
          alt="Retouch"
          width={220}
          height={80}
          className="h-16 w-auto object-contain"
          priority
        />
      </div>
      <h1 className="text-2xl font-serif font-bold text-brand tracking-[0.15em]">RETOUCH</h1>
      <p className="text-sm text-ink-soft mt-1">{subtitle ?? "引退競走馬支援プラットフォーム"}</p>
      <AuthDivider />
    </div>
  );
}
