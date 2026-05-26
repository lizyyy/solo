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
        industrial: {
          bg: "#0d1624",
          panel: "#111a2b",
          border: "#243048",
          blue: "#1e3a5f",
          blueLight: "#2f5685",
          accent: "#ff8c1a",
          accentDark: "#d97512",
          warn: "#d9363e",
          ok: "#16a34a",
          steel: "#6b7280",
          text: "#e5e7eb",
          dim: "#94a3b8",
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', '"Orbitron"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      boxShadow: {
        industrial:
          "0 0 0 1px rgba(255,140,26,0.25), 0 10px 30px -12px rgba(0,0,0,0.7)",
      },
    },
  },
  plugins: [],
};
