import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { NewsItem } from "@/types/db";

export const dynamic = "force-dynamic";

async function loadNews(id: string): Promise<NewsItem | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("news")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  return (data as NewsItem | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const news = await loadNews(params.id);
  if (!news) return { title: "お知らせ" };
  return {
    title: `${news.title} — お知らせ`,
    description: news.body?.slice(0, 120) ?? undefined,
  };
}

export default async function NewsDetailPage({ params }: { params: { id: string } }) {
  const news = await loadNews(params.id);
  if (!news) return notFound();

  return (
    <main className="max-w-3xl mx-auto px-5 py-12">
      <Link href="/" className="text-brand underline text-sm">
        ← トップへ戻る
      </Link>

      <article className="mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        {news.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={news.image_url} alt={news.title} className="w-full max-h-96 object-cover" />
        )}
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <time className="text-sm text-ink-mute tabular-nums">
              {formatDate(news.published_at)}
            </time>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${news.tag_color}`}>
              {news.tag}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink mb-5 leading-snug">{news.title}</h1>
          {news.body && (
            <div className="text-ink-soft leading-relaxed whitespace-pre-wrap">{news.body}</div>
          )}
        </div>
      </article>

      <div className="mt-8 text-center">
        <Link href="/" className="btn-ghost">
          トップへ戻る
        </Link>
      </div>
    </main>
  );
}
