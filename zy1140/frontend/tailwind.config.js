/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'apple-health': '#FF2D55',
        'dark-bg': '#1C1C1E',
        'dark-card': '#2C2C2E',
        'dark-border': '#38383A',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
