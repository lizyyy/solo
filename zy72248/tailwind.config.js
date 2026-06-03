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
        navy: {
          50: '#E8EBF0',
          100: '#C5CCD9',
          200: '#8B99B3',
          300: '#51668D',
          400: '#2D4470',
          500: '#1B2A4A',
          600: '#162240',
          700: '#111A33',
          800: '#0C1226',
          900: '#070919',
        },
        amber: {
          500: '#D97706',
          50: '#FFFBEB',
          100: '#FEF3C7',
        },
        emerald: {
          500: '#059669',
          50: '#ECFDF5',
          100: '#D1FAE5',
        },
        crimson: {
          500: '#DC2626',
          50: '#FEF2F2',
          100: '#FEE2E2',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
