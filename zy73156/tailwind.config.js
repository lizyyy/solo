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
        abyss: {
          950: "#040D16",
          900: "#06141F",
          800: "#0A2540",
          700: "#0E2D4F",
          600: "#143656",
          500: "#1B4A72",
        },
        glow: {
          cyan: "#22D3EE",
          blue: "#38BDF8",
          teal: "#2DD4BF",
        },
        warn: {
          amber: "#F59E0B",
          gold: "#FBBF24",
        },
        ok: {
          emerald: "#34D399",
        },
        block: {
          rose: "#FB7185",
          coral: "#F43F5E",
        },
      },
      fontFamily: {
        display: ['"Syncopate"', '"Orbitron"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
        body: ['"IBM Plex Sans"', '"Noto Sans SC"', "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(34,211,238,0.45)",
        "glow-amber": "0 0 24px -4px rgba(245,158,11,0.45)",
        "glow-rose": "0 0 24px -4px rgba(251,113,133,0.45)",
        glass: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 8px 32px -8px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "abyss-radial":
          "radial-gradient(120% 120% at 50% 0%, rgba(34,211,238,0.10) 0%, rgba(6,20,31,0) 45%)",
        "glass-panel":
          "linear-gradient(135deg, rgba(20,54,86,0.55) 0%, rgba(10,37,64,0.55) 100%)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.4)", opacity: "0" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
        "breathe": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        "scan": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "float-up": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-12px)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.2,0.6,0.3,1) infinite",
        "breathe": "breathe 2.8s ease-in-out infinite",
        "scan": "scan 6s linear infinite",
      },
    },
  },
  plugins: [],
};
