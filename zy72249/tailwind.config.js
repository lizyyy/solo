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
        teal: {
          50: '#F0F7F9',
          100: '#D4E8EC',
          200: '#A9D1D9',
          300: '#7EBAC7',
          400: '#53A3B4',
          500: '#1A6B7D',
          600: '#0F4C5C',
          700: '#0C3D4A',
          800: '#092E38',
          900: '#061F26',
        },
        amber: {
          50: '#FEF3EB',
          100: '#FDE1CC',
          200: '#FBC599',
          300: '#F5A66B',
          400: '#E87830',
          500: '#E36414',
          600: '#C2530E',
          700: '#9A410B',
          800: '#723008',
          900: '#4A1F05',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        sans: ['Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
