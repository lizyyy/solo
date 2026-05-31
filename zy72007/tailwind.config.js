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
          50: "#f0f5fa",
          100: "#d9e4f0",
          200: "#b3c9e1",
          300: "#85a8cd",
          400: "#5d85b8",
          500: "#3d679e",
          600: "#2d5080",
          700: "#1e3a5f",
          800: "#182d4a",
          900: "#122138",
        },
        status: {
          confirmed: "#2d5a27",
          pending: "#b45309",
          adjusted: "#7c2d12",
          processing: "#1e3a5f",
        },
      },
    },
  },
  plugins: [],
};
