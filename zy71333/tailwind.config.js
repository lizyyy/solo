/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'guqin': {
          50: '#faf8f5',
          100: '#f0ebe3',
          200: '#e0d5c5',
          300: '#ccb8a0',
          400: '#b79878',
          500: '#a67d5a',
          600: '#8b6548',
          700: '#70503a',
          800: '#5c4233',
          900: '#4c372c',
        }
      }
    },
  },
  plugins: [],
}
