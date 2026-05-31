export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gallery: {
          bg: "#1a1a1a",
          surface: "#242424",
          border: "#333333",
          fg: "#f5f0e8",
          muted: "#8a8478",
          amber: "#d4a056",
          rust: "#c45c4a",
          sage: "#6b8f71",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
    container: {
      center: true,
    },
  },
  plugins: [],
};
