/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        burgundy: {
          50: '#fdf3f4',
          100: '#fbe5e7',
          200: '#f8ced3',
          300: '#f2aab2',
          400: '#e97a86',
          500: '#dc5262',
          600: '#c93447',
          700: '#a82738',
          800: '#8c2331',
          900: '#722F37',
        },
        gold: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#D4AF37',
        },
        parchment: {
          50: '#fefdfb',
          100: '#fdf9f2',
          200: '#faf3e6',
          300: '#f5ebe0',
          400: '#EFE7DA',
          500: '#F5F2EB',
          600: '#d4c9b8',
          700: '#b5a895',
          800: '#968b7b',
          900: '#7a7165',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Lato', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
