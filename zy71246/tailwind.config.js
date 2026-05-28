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
        deep: {
          950: '#0a1628',
          900: '#0f1d35',
          800: '#1a2a4a',
          700: '#2a3a5a',
          600: '#3a4a6a',
          500: '#4a5a7a',
          400: '#6a7a9a',
          300: '#8a9aba',
        },
        gold: {
          50: '#fdf8e7',
          100: '#faf0c8',
          200: '#f4e08a',
          300: '#edcb52',
          400: '#e5b82a',
          500: '#d4af37',
          600: '#b8941f',
          700: '#95721a',
          800: '#7a5c1b',
          900: '#674b1c',
          950: '#3d2b0b',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 20s linear infinite',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};
