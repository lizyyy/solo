/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        carbon: {
          50: "#f4f6fa",
          100: "#e6e9f2",
          200: "#c7cfe0",
          300: "#93a0c0",
          400: "#596b94",
          500: "#3a4b73",
          600: "#2a3959",
          700: "#1f2b42",
          800: "#1a1f2e",
          900: "#121620",
          950: "#0c0e15",
        },
        finance: {
          green: "#10b981",
          "green-hover": "#059669",
          "green-light": "#d1fae5",
        },
        warning: {
          orange: "#f59e0b",
          "orange-hover": "#d97706",
          "orange-light": "#fef3c7",
        },
        risk: {
          red: "#ef4444",
          "red-hover": "#dc2626",
          "red-light": "#fee2e2",
        },
        custody: {
          blue: "#3b82f6",
          "blue-hover": "#2563eb",
          "blue-light": "#dbeafe",
        },
        summary: {
          gold: "#eab308",
          "gold-hover": "#ca8a04",
          "gold-light": "#fef9c3",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "card-hover": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        glow: "0 0 20px rgb(239 68 68 / 0.3)",
        "glow-blue": "0 0 20px rgb(59 130 246 / 0.3)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
