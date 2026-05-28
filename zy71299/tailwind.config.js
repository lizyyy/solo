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
          50: '#EEF2F8',
          100: '#D3DCEA',
          200: '#A8B8D5',
          300: '#7C94C0',
          400: '#5170AB',
          500: '#2C5282',
          600: '#1E3A5F',
          700: '#152944',
          800: '#0D1929',
          900: '#050A0E',
        },
        accent: {
          50: '#FBF6E9',
          100: '#F4E7C3',
          200: '#E9CF87',
          300: '#DDB74B',
          400: '#D4A843',
          500: '#B8862B',
          600: '#8C6621',
          700: '#5E4416',
          800: '#31230B',
          900: '#100C04',
        },
        warning: {
          50: '#FDF3F1',
          100: '#F9D9D3',
          200: '#F3B3A7',
          300: '#ED8C7B',
          400: '#E85D4A',
          500: '#DB3A25',
          600: '#AE2D1C',
          700: '#7B2015',
          800: '#47130D',
          900: '#140603',
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        body: ['"Source Sans 3"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
