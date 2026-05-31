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
        gallery: {
          50: "#f7f7f7",
          100: "#e8e8e8",
          200: "#d1d1d1",
          300: "#b0b0b0",
          400: "#888888",
          500: "#6d6d6d",
          600: "#555555",
          700: "#3d3d3d",
          800: "#2a2a2a",
          900: "#1a1a1a",
          950: "#0f0f0f",
        },
        accent: {
          warning: "#f59e0b",
          success: "#10b981",
          danger: "#ef4444",
          info: "#3b82f6",
        },
      },
      fontFamily: {
        sans: [
          "SF Pro Display",
          "PingFang SC",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
