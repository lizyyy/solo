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
        'aviation': {
          50: '#e6f0fa',
          100: '#bdd5f0',
          200: '#94bae6',
          300: '#6b9fdc',
          400: '#4284d2',
          500: '#1a365d',
          600: '#152c4c',
          700: '#10223b',
          800: '#0b182a',
          900: '#060e19',
        },
        'warning': {
          50: '#fef5e7',
          100: '#fce4c2',
          200: '#fad39d',
          300: '#f8c278',
          400: '#f6b153',
          500: '#ed8936',
          600: '#e07725',
          700: '#c9661e',
          800: '#a85518',
          900: '#874412',
        },
        'danger': {
          50: '#fee2e2',
          100: '#fecaca',
          200: '#fca5a5',
          300: '#f87171',
          400: '#ef4444',
          500: '#e53e3e',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        'success': {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#38a169',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Menlo', 'monospace'],
        'sans': ['PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
      },
      keyframes: {
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
        }
      }
    },
  },
  plugins: [],
};
