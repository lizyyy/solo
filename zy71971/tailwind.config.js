/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#1a2332',
          light: '#1e2a3a',
          dark: '#0f1724',
        },
        border: {
          DEFAULT: '#2a3548',
        },
      },
    },
  },
  plugins: [],
};
