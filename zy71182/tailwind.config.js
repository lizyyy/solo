/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A1F44",
        paper: "#F7F3E9",
        cmykC: "#00A0E3",
        cmykM: "#E6007E",
        cmykY: "#FFD100",
        cmykK: "#111111",
      },
      fontFamily: {
        mono: ['"Space Mono"', "ui-monospace", "monospace"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
