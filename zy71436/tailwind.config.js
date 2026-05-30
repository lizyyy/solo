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
        gallery: {
          dark: '#1a1a2e',
          card: '#1e1e30',
          surface: '#12121e',
          gold: '#c9a84c',
          ivory: '#f5f0e8',
          wine: '#8b2252',
          forest: '#2d5a3d',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', '"Noto Sans SC"', 'serif'],
        body: ['"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
