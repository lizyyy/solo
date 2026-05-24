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
          50: '#f0f5fa',
          100: '#d9e4f1',
          200: '#b3c9e3',
          300: '#86a8d1',
          400: '#5c87bd',
          500: '#3d6aa5',
          600: '#2d5387',
          700: '#26436d',
          800: '#1e3a5f',
          900: '#1b3250',
        },
        game: {
          success: '#27ae60',
          warning: '#f39c12',
          danger: '#c0392b',
          info: '#3498db',
          orange: '#e67e22',
        },
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
