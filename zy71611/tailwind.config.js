/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
    },
    extend: {
      colors: {
        "forest-green": {
          DEFAULT: "#0D4B3C",
          50: "#E8F0ED",
          100: "#D1E1DB",
          200: "#A3C3B7",
          300: "#75A593",
          400: "#47876F",
          500: "#0D4B3C",
          600: "#0A3D31",
          700: "#082F26",
          800: "#06211B",
          900: "#031310",
        },
        "amber-accent": {
          DEFAULT: "#D4A843",
          50: "#FBF6EC",
          100: "#F7EDD9",
          200: "#EFDBB3",
          300: "#E7C98D",
          400: "#D4A843",
          500: "#C49630",
          600: "#9E7926",
          700: "#785B1D",
          800: "#523E13",
          900: "#2C200A",
        },
        "sage-bg": "#F8FAF9",
        "cool-gray": "#6B7280",
        "warm-red": "#DC2626",
      },
      fontFamily: {
        serif: ['"DM Serif Display"', "Georgia", "serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
