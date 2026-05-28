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
          50: '#E8EDF5',
          100: '#C5D0E3',
          200: '#9EB0D0',
          300: '#7790BD',
          400: '#5A78AF',
          500: '#3E60A1',
          600: '#385899',
          700: '#304D8E',
          800: '#284384',
          900: '#0A2463',
        },
        warning: '#F77F00',
        danger: '#D62828',
        success: '#00A86B',
        info: '#3E92CC',
      },
      fontFamily: {
        sans: ['Source Han Sans', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
