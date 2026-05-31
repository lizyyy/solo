/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9fa',
          100: '#d6f0f3',
          200: '#ade0e7',
          300: '#7bcad7',
          400: '#4aafc3',
          500: '#0F4C5C',
          600: '#0d4250',
          700: '#0b3743',
          800: '#092c36',
          900: '#072129',
        },
        accent: {
          50: '#fef6ee',
          100: '#fce9d6',
          200: '#f9d0ad',
          300: '#f5b27d',
          400: '#f08d4a',
          500: '#E36414',
          600: '#cc5a12',
          700: '#b55010',
          800: '#9e460e',
          900: '#873c0c',
        },
      },
    },
  },
  plugins: [],
}
