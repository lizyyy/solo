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
        walnut: {
          50: "#f5f0ed",
          100: "#e8ddd6",
          200: "#d1b9ac",
          300: "#b99581",
          400: "#a27157",
          500: "#8b5a3d",
          600: "#6e4530",
          700: "#523023",
          800: "#361c17",
          900: "#2C1810",
          950: "#1a0f0a",
        },
        brass: {
          50: "#fdf9e6",
          100: "#fbf0cc",
          200: "#f7e099",
          300: "#f2d066",
          400: "#E8C04A",
          500: "#D4AF37",
          600: "#b8942b",
          700: "#927222",
          800: "#6c5118",
          900: "#46310f",
        },
        danger: {
          500: "#C41E3A",
          600: "#a0182e",
          700: "#7c1222",
        },
        success: {
          500: "#2E7D32",
          600: "#256428",
          700: "#1c4b1e",
        },
      },
    },
  },
  plugins: [],
};
