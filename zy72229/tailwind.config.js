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
          50: '#E8EBF0',
          100: '#C5CCD9',
          200: '#8E9BB3',
          300: '#576A8D',
          400: '#2E4168',
          500: '#1B2A4A',
          600: '#152240',
          700: '#101A33',
          800: '#0B1226',
          900: '#060A13',
        },
        amber: {
          400: '#E8BC5E',
          500: '#D4A843',
          600: '#C09530',
        },
        teal: {
          400: '#4ABFA8',
          500: '#2D9B83',
          600: '#1F7A66',
        },
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'Source Han Serif SC', 'STSong', 'serif'],
        sans: ['Noto Sans SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
