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
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#1E40AF',
          600: '#1E3A8A',
          700: '#172554',
        },
        status: {
          passed: '#10B981',
          pending: '#F59E0B',
          rejected: '#EF4444',
          manual: '#8B5CF6',
        },
        warn: {
          soft: '#FEF2F2',
          line: '#EF4444',
        },
        sample: {
          soft: '#FFFBEB',
          star: '#D97706',
        }
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.5s ease-in-out infinite',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(239,68,68,0.4)' },
          '50%': { opacity: '0.85', boxShadow: '0 0 0 6px rgba(239,68,68,0)' },
        },
      },
    },
  },
  plugins: [],
};
