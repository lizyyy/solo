/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        eng: {
          bg: "#0F172A",
          panel: "#1E293B",
          panel2: "#334155",
          line: "#1E40AF",
          border: "#475569",
          warn: "#EA580C",
          alert: "#DC2626",
          pass: "#15803D",
          muted: "#94A3B8",
          text: "#F1F5F9",
          dim: "#CBD5E1",
        },
        src: {
          cad: "#6366F1",
          add: "#059669",
          oral: "#D97706",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        sans: ['"Noto Sans SC"', "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        panel: "0 4px 24px -4px rgba(15,23,42,0.6)",
      },
      animation: {
        pulseRing: "pulseRing 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        slideInRight: "slideInRight .25s ease-out",
        slideUpBottom: "slideUpBottom .3s ease-out",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.9" },
          "70%,100%": { transform: "scale(1.6)", opacity: "0" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideUpBottom: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
