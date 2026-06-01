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
          50: '#f0f7f2',
          100: '#daece0',
          200: '#b8d9c2',
          300: '#8cc09d',
          400: '#5da277',
          500: '#3d865a',
          600: '#2d6b47',
          700: '#25553a',
          800: '#1f4430',
          900: '#1a3828',
          950: '#0d1f16',
        },
        earth: {
          50: '#fbf8f2',
          100: '#f5eedc',
          200: '#ebdbb8',
          300: '#dfc48e',
          400: '#d4a965',
          500: '#c99247',
          600: '#bb7a3c',
          700: '#9c6033',
          800: '#7e4e30',
          900: '#67412a',
          950: '#382115',
        },
      },
      fontFamily: {
        xiaowei: ['"ZCOOL XiaoWei"', 'serif'],
      },
    },
  },
  plugins: [],
};
