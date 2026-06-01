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
        gold: '#d4a543',
        anomaly: '#e8634f',
        coord: '#3ec9c2',
        surface: '#1a1f2e',
        deep: '#0f1219',
        silver: '#8b95a5',
        border: '#2a2f3e',
      },
    },
  },
  plugins: [],
};
