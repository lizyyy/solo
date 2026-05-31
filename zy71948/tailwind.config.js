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
        'console': {
          'bg': '#0f1419',
          'panel': '#1a1f26',
          'border': '#2a313a',
          'text': '#e6edf3',
          'muted': '#8b949e',
        },
        'eng': {
          'blue': '#1e5f8a',
          'blue-light': '#388fc4',
          'orange': '#ff6b35',
          'orange-light': '#ff8c5a',
          'green': '#2ec4b6',
          'green-light': '#45e0d1',
          'yellow': '#f7c59f',
        }
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        'sans': ['"Noto Sans SC"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        }
      }
    },
  },
  plugins: [],
};
