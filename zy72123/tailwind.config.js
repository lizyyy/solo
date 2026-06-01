/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          50: '#eef2f7',
          100: '#d4dde9',
          200: '#a9bbd3',
          300: '#7e99bd',
          400: '#5377a7',
          500: '#1a2332',
          600: '#151c29',
          700: '#101620',
          800: '#0b1017',
          900: '#060a0e',
        },
        'warn': '#e67e22',
        'ok': '#27ae60',
        'danger': '#c0392b',
        'muted': '#6c7a89',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'sans': ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
