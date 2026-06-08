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
          50: "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0F766E",
          700: "#115E59",
          800: "#134E4A",
          900: "#042F2E",
        },
        cream: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
        },
        anomaly: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          400: "#F59E0B",
          500: "#D97706",
          600: "#B45309",
          700: "#92400E",
        },
        verdict: {
          50: "#FDF2F8",
          100: "#FCE7F3",
          200: "#FBCFE8",
          400: "#EC4899",
          500: "#DB2777",
          600: "#BE185D",
          700: "#9D174D",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', '"Songti SC"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', '"Source Han Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"SF Mono"', '"Monaco"', "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 118, 110, 0.08), 0 1px 2px rgba(15, 118, 110, 0.04)",
        "card-hover": "0 6px 16px rgba(15, 118, 110, 0.12), 0 2px 4px rgba(15, 118, 110, 0.06)",
      },
      animation: {
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
        "fade-in-up": "fadeInUp 300ms ease-out",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { backgroundColor: "rgba(217, 119, 6, 0.08)" },
          "50%": { backgroundColor: "rgba(217, 119, 6, 0.28)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
