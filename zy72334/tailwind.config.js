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
        indigo: {
          950: '#1a1a2e',
          900: '#16213e',
          800: '#0f3460',
        },
        amber: {
          500: '#f0a500',
          400: '#f5bd1f',
          300: '#f8d15e',
        },
        mint: {
          600: '#0f3460',
          500: '#1a5276',
        },
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'serif'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #f0a500, 0 0 10px #f0a500' },
          '100%': { boxShadow: '0 0 10px #f0a500, 0 0 20px #f0a500, 0 0 30px #f0a500' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
