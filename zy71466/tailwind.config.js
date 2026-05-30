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
        steel: {
          DEFAULT: '#1B2A4A',
          dark: '#0F1923',
        },
        amber: {
          DEFAULT: '#E8913A',
        },
        cold: {
          DEFAULT: '#3A4A5C',
        },
        sky: {
          DEFAULT: '#4A90D9',
        },
        warn: {
          DEFAULT: '#D94A4A',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
