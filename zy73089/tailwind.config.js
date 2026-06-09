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
        serif: ['"Noto Serif SC"', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: [
          '"Noto Serif SC"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#0F172A',
        },
        warn: {
          50: '#FFF7ED',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
        },
        hold: {
          50: '#FEF2F2',
          600: '#DC2626',
          700: '#B91C1C',
        },
        ok: {
          50: '#ECFDF5',
          600: '#059669',
          700: '#047857',
        },
      },
      boxShadow: {
        'inner-blue': 'inset 0 0 0 1px rgba(59,130,246,0.25)',
      },
      keyframes: {
        breath: {
          '0%,100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
      },
      animation: {
        breath: 'breath 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
