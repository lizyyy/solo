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
        'industrial': {
          'bg': '#0f0f0f',
          'panel': '#1a1a1a',
          'border': '#2d2d2d',
          'text': '#e5e5e5',
          'muted': '#737373',
        },
        'amber': {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Menlo', 'monospace'],
        'sans': ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'pulse-urgent': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)' },
          '50%': { opacity: '0.7', boxShadow: '0 0 40px rgba(239, 68, 68, 0.9)' },
        },
        'slide-in': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(245, 158, 11, 0.6)' },
        },
      },
      animation: {
        'pulse-urgent': 'pulse-urgent 1s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
