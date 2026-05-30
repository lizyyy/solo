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
        navy: {
          50: '#E8EDF3',
          100: '#C5D1E3',
          200: '#8FA3C7',
          300: '#5975AB',
          400: '#2E4D7A',
          500: '#1E3A5F',
          600: '#1A3354',
          700: '#152B48',
          800: '#11223C',
          900: '#0C192E',
        },
        amber: {
          500: '#D97706',
          600: '#B45309',
        },
        emerald: {
          500: '#059669',
          600: '#047857',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
