/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: { center: true },
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0B1623",
          panel: "#1F4E5F",
          elevated: "#142A3B",
        },
        metal: {
          DEFAULT: "#8A9BA8",
          light: "#B4C2CC",
          dark: "#5F7280",
        },
        accent: {
          orange: "#F08A3E",
          red: "#E5484D",
          green: "#3E935A",
          blue: "#5B8DEF",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-blue": "0 0 0 1px #5B8DEF, 0 0 12px rgba(91,141,239,0.4)",
        "glow-orange": "0 0 0 1px #F08A3E, 0 0 12px rgba(240,138,62,0.4)",
        "glow-red": "0 0 0 1px #E5484D, 0 0 12px rgba(229,72,77,0.5)",
        "panel": "0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(138,155,168,0.08)",
      },
      backgroundImage: {
        "grid-dark": "linear-gradient(rgba(138,155,168,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(138,155,168,0.04) 1px, transparent 1px)",
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      animation: {
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan": "scan 3s linear infinite",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
};
