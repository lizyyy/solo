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
        deep: '#0A1628',
        panel: '#1A2332',
        card: '#1E2D3D',
        border: '#2A3A4A',
        accent: {
          green: '#00E5A0',
          red: '#FF6B6B',
          gold: '#FFD700',
          blue: '#4A90D9',
        },
        txt: {
          primary: '#E8EDF2',
          secondary: '#8899AA',
          muted: '#5A6B7C',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        cn: ['Noto Sans SC', 'sans-serif'],
        display: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
