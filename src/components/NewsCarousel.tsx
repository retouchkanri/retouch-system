"use client";

import { useEffect, useRef, useState } from "react";
import type { NewsItem } from "@/types/db";

export default function NewsCarousel({ items }: { items: NewsItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;

    let raf: number;
    let pos = 0;
    const speed = 0.5;

    const step = () => {
      if (!paused) {
        pos += speed;
        const halfWidth = el.scrollWidth / 2;
        if (pos >= halfWidth) pos -= halfWidth;
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused, items.length]);

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div
      ref={scrollRef}
      className="flex gap-6 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {doubled.map((n, i) => (
        <article
          key={`${n.id}-${i}`}
          className="bg-white shadow-sm overflow-hidden hover:shadow-lg transition-shadow group shrink-0"
          style={{ width: 320 }}
        >
          {n.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={n.image_url}
              alt={n.title}
              className="w-full h-40 object-cover"
              loading="lazy"
            />
          )}
          <div className="h-1 bg-gradient-to-r from-brand to-brand-light" />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <time className="text-xs text-ink-mute tabular-nums">
                {new Date(n.published_at).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }).replace(/\//g, ".")}
              </time>
              <span className={`text-[10px] font-bold px-2 py-0.5 ${n.tag_color}`}>{n.tag}</span>
            </div>
            <h3 className="font-bold text-sm text-ink mb-2 group-hover:text-brand transition-colors leading-snug line-clamp-2">
              {n.title}
            </h3>
            {n.body && (
              <p className="text-xs text-ink-soft leading-relaxed line-clamp-2">{n.body}</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
