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
        dc: {
          bg: '#0f1923',
          panel: '#152232',
          border: '#1e3a52',
          cold: '#00d4ff',
          hot: '#ff6b35',
          crac: '#00e5a0',
          muted: '#5a7a96',
          text: '#c8dce8',
          danger: '#ff4757',
          warning: '#ffa502',
          info: '#3742fa',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Noto Sans SC', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
