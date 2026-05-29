/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        orbitron: ["Orbitron", "monospace"],
        noto: ["Noto Sans SC", "sans-serif"],
      },
      colors: {
        "deep-space": "#0A1628",
        "track-blue": "#0D1F3C",
        "tech-cyan": "#00E5CC",
        "alert-orange": "#FF6B35",
        "border-dim": "#1A3A5C",
      },
    },
  },
  plugins: [],
};
