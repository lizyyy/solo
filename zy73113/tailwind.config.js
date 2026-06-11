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
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#1E40AF",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        industrial: {
          DEFAULT: "#1E40AF",
          dark: "#1F2937",
        },
        abnormal: "#D97706",
        normal: "#059669",
      },
      fontFamily: {
        sans: ["Noto Sans SC", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "pulse-border": "pulseBorder 1.5s ease-in-out",
        "timeline-pop": "timelinePop 0.4s ease-out forwards",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseBorder: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(217, 119, 6, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(217, 119, 6, 0)" },
        },
        timelinePop: {
          "0%": { opacity: "0", transform: "scale(0.5)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
