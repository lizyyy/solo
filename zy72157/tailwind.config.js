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
        primary: {
          50: '#f0f5fa',
          100: '#d9e4f0',
          200: '#b3c9e1',
          300: '#80a7cc',
          400: '#4d84b6',
          500: '#2d6aa3',
          600: '#1e3a5f',
          700: '#183052',
          800: '#142642',
          900: '#101e33',
        },
        warm: {
          50: '#fef7ed',
          100: '#fdecd5',
          200: '#fad5a6',
          300: '#f6b86d',
          400: '#f19336',
          500: '#e67e22',
          600: '#d35400',
          700: '#a04000',
          800: '#7a3200',
          900: '#5a2600',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
