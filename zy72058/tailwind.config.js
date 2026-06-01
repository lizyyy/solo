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
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#c9a227',
          700: '#a1801e',
          800: '#854d0e',
          900: '#713f12',
        },
        slate: {
          800: '#1e293b',
          850: '#1a1f2e',
          900: '#0f1419',
        },
      },
      fontFamily: {
        'serif-cn': ['"Noto Serif SC"', 'serif'],
        'sans-cn': ['"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
