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
        ledger: {
          bg: '#FAF8F5',
          surface: '#FFFFFF',
          border: '#E8E2DA',
          text: '#2D3A3A',
          muted: '#8A8580',
          amber: '#D4913B',
          'amber-light': '#FDF3E3',
          red: '#C0504D',
          'red-light': '#FDF0EF',
          green: '#4A8C5C',
          'green-light': '#EFF7F1',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        serif: ['Noto Serif SC', 'Georgia', 'serif'],
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
