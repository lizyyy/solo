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
          card: "#1a1d2e",
        },
        border: {
          DEFAULT: "#2a2d3e",
        },
        text: {
          primary: "#e8e8e8",
          secondary: "#8b8fa3",
        },
        accent: {
          DEFAULT: "#f59e0b",
        },
        status: {
          green: "#22c55e",
          red: "#ef4444",
          blue: "#3b82f6",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Noto Sans SC", "sans-serif"],
      },
    },
  },
  plugins: [],
};
