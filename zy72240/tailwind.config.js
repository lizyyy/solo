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
        pine: {
          50: "#F0FDF4",
          100: "#D8F3DC",
          200: "#B7E4C7",
          300: "#95D5B2",
          400: "#74C69D",
          500: "#52B788",
          600: "#40916C",
          700: "#2D6A4F",
          800: "#1B4332",
          900: "#0B2F1F",
        },
        gold: {
          50: "#FBF3DB",
          100: "#F7E7B8",
          200: "#ECD491",
          300: "#E0BE6A",
          400: "#D4A843",
          500: "#B8892A",
          600: "#936D1E",
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};
