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
          50: '#f0f5ff',
          100: '#e0ebff',
          200: '#b9d0ff',
          300: '#7aa6ff',
          400: '#3b76ff',
          500: '#1a365d',
          600: '#142949',
          700: '#0f1f37',
          800: '#0a1525',
          900: '#050a12',
        },
        accent: {
          orange: '#dd6b20',
          green: '#276749',
          red: '#c53030',
          yellow: '#d69e2e',
          blue: '#2b6cb0',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breath': 'breath 2s ease-in-out infinite',
      },
      keyframes: {
        breath: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
};
