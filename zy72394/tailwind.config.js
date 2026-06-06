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
          50: "#f0f5ff",
          100: "#e0ebff",
          200: "#b9d3ff",
          300: "#7badff",
          400: "#357fff",
          500: "#1e3a5f",
          600: "#1a3150",
          700: "#162942",
          800: "#122134",
          900: "#0e1926",
        },
        industry: {
          blue: "#1e3a5f",
          steel: "#4a5568",
          concrete: "#718096",
          warning: "#f59e0b",
          danger: "#ef4444",
          success: "#10b981",
        },
      },
      fontFamily: {
        sans: ["Source Han Sans CN", "Noto Sans SC", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-in-out",
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
