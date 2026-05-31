/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        lab: {
          bg: "#1a2332",
          bgLight: "#253042",
          bgLighter: "#2f3d54",
          text: "#e8ecf1",
          textMuted: "#9aa7b8",
          accent: "#d4a843",
          accentHover: "#e5bb5c",
          danger: "#c94040",
          success: "#3a9a5c",
          warning: "#d4a843",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Noto Sans SC", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-amber": "0 0 12px rgba(212, 168, 67, 0.3)",
        "glow-amber-strong": "0 0 20px rgba(212, 168, 67, 0.5)",
      },
    },
  },
  plugins: [],
};
