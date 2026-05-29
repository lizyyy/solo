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
          primary: "#121217",
          secondary: "#1A1A21",
          tertiary: "#25252F",
          elevated: "#2D2D3A",
        },
        accent: {
          cyan: "#00F0FF",
          purple: "#A855F7",
          orange: "#FF6B35",
          green: "#10B981",
          red: "#EF4444",
        },
        text: {
          primary: "#F8FAFC",
          secondary: "#94A3B8",
          muted: "#64748B",
        },
        border: {
          default: "#334155",
          focused: "#00F0FF",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        display: ["Inter", "sans-serif"],
        numeric: ["Roboto Mono", "monospace"],
      },
      boxShadow: {
        neon: "0 0 20px rgba(0, 240, 255, 0.3)",
        "neon-sm": "0 0 10px rgba(0, 240, 255, 0.2)",
        "neon-purple": "0 0 20px rgba(168, 85, 247, 0.3)",
        "neon-orange": "0 0 15px rgba(255, 107, 53, 0.4)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "flow": "flow 1.5s ease-in-out infinite",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 240, 255, 0.2)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 240, 255, 0.5)" },
        },
        flow: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
};
