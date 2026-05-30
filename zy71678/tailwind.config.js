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
        forest: {
          50: '#F0F7F2',
          100: '#D4E8D9',
          200: '#A8D1B3',
          300: '#7CBA8D',
          400: '#50996B',
          500: '#2D7A4A',
          600: '#1B5E34',
          700: '#0F2419',
          800: '#0A1A10',
          900: '#050D08',
        },
        amber: {
          50: '#FDF8ED',
          100: '#F9EDCF',
          200: '#F0D89E',
          300: '#E5BF6B',
          400: '#D4A853',
          500: '#C4923B',
          600: '#A87430',
          700: '#8C5A26',
          800: '#70431C',
          900: '#542D12',
        },
        warm: {
          50: '#FAF9F7',
          100: '#F5F3EF',
          200: '#EBE7DF',
          300: '#DDD7CB',
          400: '#C4BCAC',
          500: '#A9A08C',
          600: '#8E846F',
          700: '#736957',
          800: '#5A5245',
          900: '#3D382F',
        },
        danger: '#DC2626',
        warning: '#F59E0B',
        info: '#3B82F6',
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Noto Sans"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
