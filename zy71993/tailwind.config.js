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
        navy: {
          900: '#0a0a1a',
          800: '#1a1a2e',
          700: '#16213e',
          600: '#1c2a4a',
          500: '#233554',
        },
        accent: {
          cyan: '#00d2ff',
          blue: '#0f3460',
          red: '#e94560',
          amber: '#f59e0b',
          green: '#10b981',
          purple: '#8b5cf6',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
