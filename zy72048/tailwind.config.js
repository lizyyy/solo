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
        "cliff-brown": "#8B6914",
        "rope-orange": "#E8712B",
        "chalk-white": "#F5F0E8",
        "rock-dark": "#2C1810",
        "moss-green": "#4A7C59",
        "amber-warn": "#D4A017",
        "danger-red": "#C0392B",
        "card-bg": "#FDF9F3",
        "border-warm": "#D9CDB8",
      },
    },
  },
  plugins: [],
};
