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
        bg: {
          DEFAULT: "#0f1117",
          lighter: "#151823",
          card: "#1a1d2b",
          hover: "#252938",
          border: "#2d3244",
        },
        brand: {
          amber: "#f59e0b",
          amberLight: "#fbbf24",
          amberDark: "#d97706",
        },
        status: {
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#f43f5e",
          info: "#3b82f6",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)",
        glow: "0 0 20px rgba(245, 158, 11, 0.15)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "grow-in": {
          "0%": { transform: "scaleY(0)", transformOrigin: "bottom" },
          "100%": { transform: "scaleY(1)", transformOrigin: "bottom" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "grow-in": "grow-in 0.6s ease-out",
      },
    },
  },
  plugins: [],
};
