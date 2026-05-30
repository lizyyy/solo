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
        walnut: {
          50: "#f5f2ef",
          100: "#e9e2db",
          200: "#d5c5b8",
          300: "#bfa390",
          400: "#a88169",
          500: "#946a52",
          600: "#7a5443",
          700: "#624338",
          800: "#523931",
          900: "#3E2723",
          950: "#2a1914",
        },
        bronze: {
          50: "#fdf8ed",
          100: "#faefd6",
          200: "#f5dbaa",
          300: "#eec274",
          400: "#e6a23c",
          500: "#DAA520",
          600: "#B8860B",
          700: "#996b0d",
          800: "#7d5512",
          900: "#684714",
          950: "#3d2708",
        },
        charcoal: {
          50: "#f6f6f6",
          100: "#e7e7e7",
          200: "#d1d1d1",
          300: "#b0b0b0",
          400: "#888888",
          500: "#6d6d6d",
          600: "#5d5d5d",
          700: "#4f4f4f",
          800: "#454545",
          900: "#3d3d3d",
          950: "#121212",
        },
        acoustic: {
          low: "#1E88E5",
          mid: "#43A047",
          high: "#E53935",
        },
      },
      fontFamily: {
        serif: ['"Source Han Serif SC"', '"Noto Serif SC"', "SimSun", "serif"],
        mono: ['"Roboto Mono"', '"JetBrains Mono"', "Consolas", "monospace"],
      },
      boxShadow: {
        "bronze-glow": "0 0 20px rgba(184, 134, 11, 0.3)",
        "bronze-glow-hover": "0 0 30px rgba(184, 134, 11, 0.5)",
        "inner-walnut": "inset 0 2px 4px rgba(62, 39, 35, 0.3)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
