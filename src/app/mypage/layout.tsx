import { requireMember } from "@/lib/auth";

export default async function MyPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMember();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {children}
      </main>
      <footer className="py-6 text-center text-xs text-ink-mute space-y-1">
        <p>© Retouchメンバーズサイト</p>
        {process.env.CONTACT_EMAIL && (
          <p>
            お問い合わせ:{" "}
            <a className="underline" href={`mailto:${process.env.CONTACT_EMAIL}`}>
              {process.env.CONTACT_EMAIL}
            </a>
          </p>
        )}
      </footer>
    </div>
  );
}
