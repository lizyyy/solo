/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sand': '#F4E4BC',
        'sand-dark': '#E8D4A8',
        'ocean': '#4A90A4',
        'ocean-dark': '#3A7A8C',
        'forest': '#2D5016',
        'forest-light': '#3D6B1E',
        'clay': '#C67B4A',
        'clay-dark': '#A86339',
      },
    },
  },
  plugins: [],
}
