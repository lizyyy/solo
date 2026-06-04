export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1B2A4A",
        accent: "#E8792B",
        success: "#2D9B5A",
        warning: "#D4A72C",
        danger: "#C4463A",
        "neutral-light": "#F5F7FA",
        "neutral-dark": "#2A3547",
      },
      fontFamily: {
        sans: ["Noto Sans SC", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
}
