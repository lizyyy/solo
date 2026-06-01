/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'charcoal': '#1a1a2e',
        'warning-orange': '#ff6b35',
        'calm-blue': '#4ecdc4',
        'paper-cream': '#f7f3e9',
        'danger-red': '#e63946',
        'success-green': '#2a9d8f',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'monospace'],
        'sans': ['Noto Sans SC', 'sans-serif'],
      },
      animation: {
        'shake': 'shake 0.5s ease-in-out',
        'pulse-fast': 'pulse 0.5s ease-in-out',
        'float-up': 'floatUp 1s ease-out forwards',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        floatUp: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-30px)' },
        },
      },
    },
  },
  plugins: [],
}
