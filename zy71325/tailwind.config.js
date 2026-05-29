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
        brand: {
          bg: "#0F0F1A",
          surface: "#12122A",
          elevated: "#1A1A35",
          border: "#2A2A4A",
          borderHover: "#3A3A5A",
          amber: "#E8A838",
          emerald: "#2ECC71",
          coral: "#E74C3C",
          blue: "#3498DB",
          purple: "#9B59B6",
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
