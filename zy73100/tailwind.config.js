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
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        anomaly: {
          bg: "#FEE2E2",
          border: "#DC2626",
          text: "#991B1B",
        },
        note: {
          bg: "#FEF3C7",
          border: "#D97706",
          text: "#92400E",
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(30,64,175,0.08), 0 1px 2px 0 rgba(30,64,175,0.04)",
        "card-hover":
          "0 4px 12px 0 rgba(30,64,175,0.12), 0 2px 4px 0 rgba(30,64,175,0.06)",
      },
      animation: {
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "flash-border": "flash-border 1.6s ease-in-out infinite",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.9" },
          "70%": { transform: "scale(1.8)", opacity: "0" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        "flash-border": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(220,38,38,0.4)" },
          "50%": { boxShadow: "0 0 0 4px rgba(220,38,38,0.15)" },
        },
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(30,64,175,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.04) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "24px 24px",
      },
    },
  },
  plugins: [],
};
