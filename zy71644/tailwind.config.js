/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'navy': {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#1e3a5f',
          900: '#102a43',
        },
        'gold': {
          50: '#fef9e7',
          100: '#fcf0c2',
          200: '#f7e089',
          300: '#f0c950',
          400: '#e9b42a',
          500: '#c9a227',
          600: '#a6851f',
          700: '#846818',
          800: '#634d11',
          900: '#42330a',
        },
      },
      fontFamily: {
        'serif': ['"Source Han Serif SC"', '"Noto Serif SC"', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
