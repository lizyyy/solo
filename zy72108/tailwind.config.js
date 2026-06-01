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
        brand: {
          DEFAULT: '#c47f17',
          light: '#d99a3a',
          dark: '#a06510',
          muted: '#8b6914',
        },
        surface: {
          DEFAULT: '#1a1a2e',
          raised: '#222240',
          overlay: '#2a2a4a',
          border: '#3a3a5c',
        },
        data: {
          normal: '#4ade80',
          warning: '#f5d7a1',
          anomaly: '#d4443e',
          info: '#60a5fa',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
