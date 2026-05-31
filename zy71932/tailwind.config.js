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
        surface: {
          DEFAULT: '#1a1a1a',
          50: '#2a2a2a',
          100: '#333333',
          200: '#444444',
          300: '#555555',
        },
        amber: {
          DEFAULT: '#F59E0B',
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          400: '#FBBF24',
          600: '#D97706',
          800: '#92400E',
        },
        confirm: {
          DEFAULT: '#10B981',
          50: '#ECFDF5',
          100: '#D1FAE5',
          600: '#059669',
          800: '#065F46',
        },
        danger: {
          DEFAULT: '#EF4444',
          50: '#FEF2F2',
          100: '#FEE2E2',
          600: '#DC2626',
          800: '#991B1B',
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
