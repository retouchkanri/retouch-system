import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    borderRadius: {
      none: "0",
      sm: "2px",
      DEFAULT: "3px",
      md: "4px",
      lg: "5px",
      xl: "5px",
      "2xl": "5px",
      "3xl": "5px",
      full: "5px",
    },
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
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
