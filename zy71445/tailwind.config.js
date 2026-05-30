/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        stage: {
          dark: "#0f0f1a",
          darker: "#1a1a2e",
          panel: "#252538",
          gray: "#4a4a5a",
        },
        accent: {
          red: "#c41e3a",
          amber: "#ffb800",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Menlo", "monospace"],
        sans: ["Noto Sans SC", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
