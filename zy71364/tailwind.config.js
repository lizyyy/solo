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
        primary: {
          DEFAULT: "#8B6914",
          50: "#F5EDD4",
          100: "#E8D9A8",
          200: "#D4BC6E",
          300: "#C4A24A",
          400: "#A5801F",
          500: "#8B6914",
          600: "#725510",
          700: "#5A430D",
          800: "#433209",
          900: "#2C2106",
        },
        ivory: {
          DEFAULT: "#FAF8F0",
          50: "#FDFCF8",
          100: "#FAF8F0",
          200: "#F5F0E0",
          300: "#EDE5C8",
        },
        amber: {
          DEFAULT: "#D4A843",
          50: "#FBF5E5",
          100: "#F5E8C8",
          200: "#EDDA9E",
          300: "#D4A843",
          400: "#C49A30",
          500: "#A87E20",
        },
        "anomaly-red": {
          DEFAULT: "#8B2500",
          50: "#FBE8E0",
          100: "#F5C8B5",
          200: "#E09060",
          300: "#B84820",
          400: "#8B2500",
          500: "#6B1D00",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
