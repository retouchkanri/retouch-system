"use client";

import { useEffect } from "react";

export default function HomeHeroEffect() {
  useEffect(() => {
    const onScroll = () => {
      const threshold = window.innerHeight * 0.55;
      document.body.classList.toggle("hero-active", window.scrollY < threshold);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.body.classList.remove("hero-active");
    };
  }, []);

  return null;
}
