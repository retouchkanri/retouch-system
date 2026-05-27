import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2d6a4f",
          dark: "#1b4332",
          light: "#95d5b2",
          50: "#f1faf4",
          100: "#dff3e6",
        },
        ink: {
          DEFAULT: "#1f2937",
          soft: "#4b5563",
          mute: "#6b7280",
        },
        surface: {
          DEFAULT: "#ffffff",
          soft: "#f7f8fa",
          line: "#e5e7eb",
        },
        warn: "#b45309",
        danger: "#b91c1c",
        ok: "#15803d",
      },
      fontFamily: {
        sans: [
          "var(--font-noto-sans-jp)",
          "Noto Sans JP",
          "Hiragino Sans",
          "Hiragino Kaku Gothic ProN",
          "Meiryo",
          "system-ui",
          "sans-serif",
        ],
        serif: [
          "var(--font-noto-serif-jp)",
          "Noto Serif JP",
          "Georgia",
          "serif",
        ],
        brand: [
          "var(--font-pacifico)",
          "Pacifico",
          "cursive",
        ],
      },
      borderRadius: {
        none: "0",
        xl: "0",
        "2xl": "0",
        lg: "0",
        md: "0",
        sm: "0",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
