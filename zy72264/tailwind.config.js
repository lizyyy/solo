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
        tunnel: {
          bg: '#1a1a2e',
          surface: '#16213e',
          card: '#1e2a45',
          border: '#2a3a5c',
          muted: '#8892b0',
          fg: '#e6e6e6',
          accent: '#e2a04a',
          info: '#4a7c9b',
          danger: '#c44536',
          success: '#2d6a4f',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
