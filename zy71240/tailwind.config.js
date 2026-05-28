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
        steel: {
          50: "#E8EDF4",
          100: "#D0D9E9",
          200: "#A1B3D3",
          300: "#728DBD",
          400: "#4367A7",
          500: "#1B2A4A",
          600: "#162240",
          700: "#111A33",
          800: "#0C1226",
          900: "#070919",
        },
        amber: {
          DEFAULT: "#E8913A",
          light: "#F0A85C",
          dark: "#C67A2E",
        },
        jade: {
          DEFAULT: "#2D9B6E",
          light: "#4AAF86",
          dark: "#248059",
        },
        cream: "#F5F3EF",
        cool: "#6B7B8D",
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
