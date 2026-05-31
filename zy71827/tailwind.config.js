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
        mountain: {
          50: "#f0f5ff",
          100: "#dce8ff",
          200: "#b0c9ff",
          300: "#6fa0ff",
          400: "#3c76e6",
          500: "#1e3a5f",
          600: "#1a3352",
          700: "#162a44",
          800: "#122236",
          900: "#0e1a28",
        },
        ice: {
          400: "#60a5fa",
          500: "#3b82f6",
        },
        status: {
          confirmed: "#10b981",
          pending: "#eab308",
          manual: "#f97316",
          missed: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["'PingFang SC'", "'Noto Sans SC'", "'Microsoft YaHei'", "system-ui", "-apple-system", "sans-serif"],
        display: ["'PingFang SC'", "'Noto Sans SC'", "'Microsoft YaHei'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 20px -2px rgba(30, 58, 95, 0.1)",
        cardHover: "0 8px 30px -4px rgba(30, 58, 95, 0.15)",
        glow: "0 0 20px rgba(96, 165, 250, 0.3)",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};
