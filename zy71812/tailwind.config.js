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
        bg: {
          primary: "#0f172a",
          secondary: "#1e293b",
          tertiary: "#334155",
          card: "#1e293b",
          border: "#475569",
        },
        status: {
          normal: "#059669",
          pending: "#d97706",
          anomaly: "#dc2626",
        },
        text: {
          primary: "#f1f5f9",
          secondary: "#94a3b8",
          muted: "#64748b",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Noto Sans SC", "system-ui", "sans-serif"],
      },
      fontSize: {
        "data-xs": ["11px", "14px"],
        "data-sm": ["12px", "16px"],
        "data-base": ["13px", "18px"],
      },
    },
  },
  plugins: [],
};
