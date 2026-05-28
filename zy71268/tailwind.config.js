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
        'eng-dark': '#0d1117',
        'eng-panel': '#16213e',
        'eng-bar': '#1a1a2e',
        'eng-blue': '#0077b6',
        'eng-orange': '#f77f00',
        'eng-red': '#d62828',
        'eng-green': '#2d6a4f',
      },
      fontFamily: {
        rajdhani: ['Rajdhani', 'sans-serif'],
        noto: ['Noto Sans SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
