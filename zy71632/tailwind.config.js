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
        'ski-bg': '#0a0e1a',
        'ski-panel': '#0d1225',
        'ski-accent': '#4fc3f7',
        'ski-warn': '#ff9800',
        'ski-error': '#ef5350',
        'ski-success': '#66bb6a',
        'ski-text': '#e8eaf6',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
