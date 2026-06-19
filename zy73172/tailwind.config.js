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
        ink: {
          50: "#F5F8F9",
          100: "#E5EEF0",
          200: "#C4D7DC",
          300: "#93B4BE",
          400: "#5E8B99",
          500: "#3C6B7A",
          600: "#2A5564",
          700: "#1E424F",
          800: "#14323D",
          900: "#0F4C5C",
          950: "#0A2E38",
        },
        ochre: {
          50: "#FEF6EE",
          100: "#FCE8D4",
          200: "#F8CEA3",
          300: "#F3AC6A",
          400: "#ED8533",
          500: "#E36414",
          600: "#C94A0B",
          700: "#A7390B",
          800: "#853010",
          900: "#6B2912",
        },
        paper: {
          50: "#FBF9F3",
          100: "#F5F0E1",
          200: "#EDE3C7",
          300: "#E2D0A3",
          400: "#D4B778",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', '"Songti SC"', "serif"],
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', "sans-serif"],
      },
      boxShadow: {
        paper: "0 1px 3px rgba(15, 76, 92, 0.08), 0 4px 12px rgba(15, 76, 92, 0.06)",
        "paper-lg": "0 4px 12px rgba(15, 76, 92, 0.1), 0 16px 32px rgba(15, 76, 92, 0.08)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "slide-up": {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "slide-up": "slide-up 0.35s ease-out both",
        "fade-in": "fade-in 0.3s ease-out both",
      },
    },
  },
  plugins: [],
};
