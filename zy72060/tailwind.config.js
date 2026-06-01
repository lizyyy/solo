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
        'crane-bg': '#0A1520',
        'crane-panel': '#0F1923',
        'crane-card': '#1B2B3A',
        'crane-wire': '#2A3F52',
        'crane-accent': '#00E5A0',
        'crane-danger': '#FF4757',
        'crane-warn': '#FFA502',
        'crane-muted': '#5B6B7D',
      },
      fontFamily: {
        display: ['Rajdhani', 'Noto Sans SC', 'sans-serif'],
        body: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
