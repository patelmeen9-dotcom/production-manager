import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        "panel-muted": "var(--panel-muted)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        "ink-faint": "var(--ink-faint)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        "on-time": "var(--on-time)",
        "on-time-bg": "var(--on-time-bg)",
        warn: "var(--warn)",
        "warn-bg": "var(--warn-bg)",
        delayed: "var(--delayed)",
        "delayed-bg": "var(--delayed-bg)",
        accent: "var(--accent)",
        "accent-bg": "var(--accent-bg)",
        input: "var(--input)",
        ring: "var(--ring)",
        surface: {
          DEFAULT: "var(--panel)",
          raised: "var(--panel-muted)",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "Inter", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
