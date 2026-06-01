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
        coffee: {
          50: "#FAF3E0",
          100: "#F0E6CC",
          200: "#E0CFA3",
          300: "#D4B87A",
          400: "#C49A52",
          500: "#8B5E3C",
          600: "#6D4A2E",
          700: "#4E3520",
          800: "#3E2723",
          900: "#2C1A14",
        },
        alert: {
          red: "#D32F2F",
          amber: "#FF8F00",
          blue: "#1565C0",
        },
      },
      fontFamily: {
        serif: ["Noto Serif SC", "serif"],
        sans: ["Noto Sans SC", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
