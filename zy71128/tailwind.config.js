/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        terrain: {
          50: '#faf5f0',
          100: '#ebe3d9',
          200: '#d7c5b0',
          300: '#c2a686',
          400: '#ad875c',
          500: '#996832',
          600: '#7a5328',
          700: '#5c3e1e',
          800: '#3d2a14',
          900: '#1f150a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
