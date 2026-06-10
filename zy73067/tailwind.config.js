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
          50: "#f0f4f9",
          100: "#d7e1ee",
          200: "#afc4dd",
          300: "#87a5cc",
          400: "#5f87bb",
          500: "#3769aa",
          600: "#1e3a5f",
          700: "#182f4c",
          800: "#122339",
          900: "#0c1826",
        },
        alert: {
          50: "#fdf0ec",
          100: "#f9d8cd",
          200: "#f3b19b",
          300: "#ed8a69",
          400: "#e85d3c",
          500: "#d04a2b",
          600: "#a83b22",
          700: "#802c1a",
          800: "#581d11",
          900: "#300e09",
        },
        success: {
          50: "#edf6f1",
          100: "#d0e8db",
          200: "#a1d1b7",
          300: "#72ba93",
          400: "#43a36f",
          500: "#2f7d4f",
          600: "#25643f",
          700: "#1c4b2f",
          800: "#123220",
          900: "#091910",
        },
        surface: {
          DEFAULT: "#f4f6f9",
          elevated: "#ffffff",
          muted: "#e8ebf0",
        },
      },
      fontFamily: {
        sans: [
          "Source Han Sans CN",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
        serif: [
          "Source Han Serif CN",
          "Noto Serif SC",
          "SimSun",
          "serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "SF Mono",
          "monospace",
        ],
      },
      borderRadius: {
        industrial: "2px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(30, 58, 95, 0.08), 0 1px 2px rgba(30, 58, 95, 0.04)",
        "card-hover": "0 4px 12px rgba(30, 58, 95, 0.12), 0 2px 4px rgba(30, 58, 95, 0.08)",
        drawer: "-4px 0 24px rgba(30, 58, 95, 0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-top": "slideInTop 0.4s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        "stagger-1": "staggerIn 0.4s ease-out 0.05s both",
        "stagger-2": "staggerIn 0.4s ease-out 0.1s both",
        "stagger-3": "staggerIn 0.4s ease-out 0.15s both",
        "stagger-4": "staggerIn 0.4s ease-out 0.2s both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInTop: {
          "0%": { transform: "translateY(-20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        staggerIn: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
