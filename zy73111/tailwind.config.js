/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        engineering: {
          navy: '#1e3a5f',
          'navy-dark': '#152a45',
          'navy-light': '#2c5282',
        },
        caution: {
          orange: '#e67e22',
          'orange-light': '#fde4c8',
        },
        audit: {
          green: '#27ae60',
          'green-light': '#c6f6d5',
        },
        history: {
          gray: '#7f8c8d',
          'gray-light': '#ecf0f1',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Source Han Sans CN"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
        title: ['"Noto Serif SC"', '"Source Han Serif CN"', 'Georgia', 'serif'],
      },
      boxShadow: {
        panel: '0 1px 3px rgba(30, 58, 95, 0.15), 0 0 0 1px rgba(30, 58, 95, 0.08)',
        inset: 'inset 0 1px 2px rgba(30, 58, 95, 0.06)',
      },
      animation: {
        'pulse-ring': 'pulseRing 1.2s ease-out',
        'save-flash': 'saveFlash 600ms ease-out',
        'badge-in': 'badgeIn 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(230, 126, 34, 0.6)' },
          '100%': { boxShadow: '0 0 0 12px rgba(230, 126, 34, 0)' },
        },
        saveFlash: {
          '0%': { backgroundColor: 'rgba(39, 174, 96, 0.18)' },
          '100%': { backgroundColor: 'transparent' },
        },
        badgeIn: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
