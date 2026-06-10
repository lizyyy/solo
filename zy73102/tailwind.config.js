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
        "engineering-blue": "#1F3A5F",
        "warning-orange": "#E8823D",
        "pass-green": "#3DAE6F",
        "concrete-gray": "#6B7280",
        "roof-slate": "#374151",
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
