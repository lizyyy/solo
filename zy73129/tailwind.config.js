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
        ocean: {
          50: '#E8F4F8',
          100: '#B8DDE8',
          200: '#88C6D8',
          300: '#58AFC8',
          400: '#2898B8',
          500: '#0A2540',
          600: '#081E33',
          700: '#061726',
          800: '#041019',
          900: '#02080C',
        },
        coral: {
          50: '#FFF0EC',
          100: '#FFD9CF',
          200: '#FFC2B2',
          300: '#FFAB95',
          400: '#FF9478',
          500: '#FF6B4A',
          600: '#E5522F',
          700: '#CC3A14',
          800: '#992C0F',
          900: '#661E0A',
        },
        seafoam: {
          50: '#E8FAF9',
          100: '#B8F0ED',
          200: '#88E6E1',
          300: '#58DCD5',
          400: '#28D2C9',
          500: '#4ECDC4',
          600: '#3BB5AD',
          700: '#2E918A',
          800: '#216D68',
          900: '#144946',
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
