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
        primary: {
          50: '#eef2f7',
          100: '#d5dfea',
          200: '#a9bed2',
          300: '#7395b5',
          400: '#49719a',
          500: '#2d5780',
          600: '#1e3a5f',
          700: '#182e4c',
          800: '#14263e',
          900: '#0f1d2f',
        },
        farm: {
          50: '#ecf8f2',
          100: '#c8ecd9',
          200: '#92d9b5',
          300: '#58c08e',
          400: '#2da56e',
          500: '#2d8a5e',
          600: '#226d4b',
          700: '#1c563c',
          800: '#184531',
          900: '#143929',
        },
        status: {
          confirmed: '#4b5563',
          pending: '#d97706',
          modified: '#dc2626',
        },
        mono: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
        sans: ['"Noto Sans SC"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
