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
        survey: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#1e40af',
          700: '#1e3a8a',
          800: '#1e3a8a',
          900: '#172554',
        },
        warning: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'inner-glow': 'inset 0 0 20px rgba(59, 130, 246, 0.1)',
        'conflict': '0 0 0 2px rgba(239, 68, 68, 0.3), 0 0 20px rgba(239, 68, 68, 0.15)',
        'pending': '0 0 0 2px rgba(249, 115, 22, 0.4), 0 0 20px rgba(249, 115, 22, 0.2)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink-orange': 'blink-orange 2s ease-in-out infinite',
        'diff-highlight': 'diff-highlight 0.6s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.4s ease-out',
      },
      keyframes: {
        'blink-orange': {
          '0%, 100%': { boxShadow: '0 0 0 2px rgba(249, 115, 22, 0.3)' },
          '50%': { boxShadow: '0 0 0 4px rgba(249, 115, 22, 0.6), 0 0 20px rgba(249, 115, 22, 0.4)' },
        },
        'diff-highlight': {
          '0%': { transform: 'scale(1)', backgroundColor: 'rgba(239, 68, 68, 0)' },
          '50%': { transform: 'scale(1.02)', backgroundColor: 'rgba(239, 68, 68, 0.2)' },
          '100%': { transform: 'scale(1)', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
