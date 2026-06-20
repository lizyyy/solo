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
        paper: "#f4efe6",
        paperDeep: "#ece4d6",
        paperLine: "#e3d8c4",
        ink: "#1a1a1a",
        inkSoft: "#3f3a34",
        inkMute: "#6f6557",
        rule: "#d9cfbf",
        vermilion: {
          DEFAULT: "#c8392f",
          soft: "#e7b7b2",
          deep: "#9e2a22",
        },
        indigoInk: "#2f4858",
        moss: "#5b7c5a",
        amberInk: "#9a6a1a",
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        dossier: "0 1px 0 0 rgba(26,26,26,0.04), 0 12px 30px -18px rgba(26,26,26,0.22)",
      },
    },
  },
  plugins: [],
};
