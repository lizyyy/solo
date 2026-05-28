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
        'bg-primary': '#1A1A2E',
        'bg-secondary': '#16213E',
        'bg-card': '#0F3460',
        'accent-warm': '#E8A838',
        'accent-green': '#48BB78',
        'text-primary': '#F7F8FC',
        'text-secondary': '#A0AEC0',
        'border-custom': '#2D3748',
        'critical': '#FC8181',
        'warning': '#F6AD55',
        'info': '#63B3ED',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
