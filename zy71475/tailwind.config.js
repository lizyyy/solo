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
          50: '#FFFDF8',
          100: '#F5F0EB',
          200: '#E7DFD5',
          300: '#D6CFC7',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#3E2723',
          800: '#2D1B14',
          900: '#1A0F0A',
        },
        gold: {
          300: '#F0D890',
          400: '#E0C068',
          500: '#D4A84B',
          600: '#B8923A',
          700: '#9A7A2E',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'Noto Sans SC', 'serif'],
        body: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
