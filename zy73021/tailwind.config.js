/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#1E6FD9',
          600: '#1A5FC0',
          700: '#154EA2',
          800: '#113E84',
          900: '#0D2E65',
        },
        health: '#10B981',
        warn: '#F59E0B',
        danger: '#EF4444',
        bg: '#F5F8FC',
      },
      fontFamily: {
        serif: ['"Source Serif Pro"', 'Georgia', 'serif'],
        sans: ['Lato', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        'stagger-in': 'stagger-in 0.45s ease-out both',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'stagger-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06), 0 4px 16px -6px rgba(30,111,217,0.12)',
        panel: '0 8px 32px -12px rgba(16,24,40,0.18), 0 2px 6px rgba(16,24,40,0.04)',
      },
    },
  },
  plugins: [],
}
