/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Songti SC"', 'SimSun', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#0c1e4b',
        },
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
      },
      keyframes: {
        pulseYellow: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: '#fde047' },
        },
      },
      animation: {
        'pulse-yellow': 'pulseYellow 0.35s ease-in-out 3',
      },
    },
  },
  plugins: [],
};
