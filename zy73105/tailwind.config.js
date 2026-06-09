/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        status: {
          confirmed: '#10b981',
          'confirmed-bg': '#d1fae5',
          pending: '#f59e0b',
          'pending-bg': '#fef3c7',
          returned: '#f43f5e',
          'returned-bg': '#ffe4e6',
          late: '#f97316',
          'late-bg': '#ffedd5',
          layer: '#ec4899',
          'layer-bg': '#fce7f3',
        },
      },
      animation: {
        'slide-in-right': 'slideInRight 400ms ease-out',
        'fade-in-stagger': 'fadeIn 300ms ease-out both',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.75' },
        },
      },
      boxShadow: {
        'inner-border': 'inset 0 0 0 1px rgba(148, 163, 184, 0.15)',
        'card-hover': '0 4px 16px -4px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};
