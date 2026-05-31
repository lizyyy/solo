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
        charcoal: {
          50: "#2D2D44",
          100: "#26263C",
          200: "#1F1F33",
          300: "#1A1A2E",
          400: "#151524",
          500: "#10101A",
        },
        forest: {
          50: "#2A3A5C",
          100: "#22304E",
          200: "#1B2740",
          300: "#16213E",
          400: "#111A30",
          500: "#0C1322",
        },
        gold: {
          50: "#F5E6C8",
          100: "#EED9A9",
          200: "#E8C88A",
          300: "#E8B86D",
          400: "#D4A652",
          500: "#B88B3D",
        },
        ivory: {
          50: "#FDFCFB",
          100: "#FAF8F5",
          200: "#F5F0E8",
          300: "#EDE6DA",
          400: "#E0D8D0",
          500: "#C8BEB2",
        },
      },
      fontFamily: {
        serif: ["'Noto Serif SC'", "serif"],
        sans: ["'Noto Sans SC'", "sans-serif"],
      },
      animation: {
        "pulse-gold": "pulse-gold 2s infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out",
      },
      keyframes: {
        "pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(232, 184, 109, 0.4)" },
          "50%": { boxShadow: "0 0 0 10px rgba(232, 184, 109, 0)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
