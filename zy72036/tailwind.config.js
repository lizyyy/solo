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
        chalkboard: {
          DEFAULT: '#1a1a2e',
          light: '#252547',
          dark: '#0f0f1a',
        },
        chalk: {
          DEFAULT: '#f5f5f5',
          muted: '#a0a0a0',
        },
        skate: {
          black: '#1a1a2e',
          chalk: '#f5f5f5',
          'chalk-dim': '#a0a0a0',
          orange: '#ff6b35',
          red: '#e63946',
          blue: '#457b9d',
          teal: '#2a9d8f',
          yellow: '#f4d35e',
        },
      },
      fontFamily: {
        handwriting: ['Caveat', 'cursive'],
        hand: ['Caveat', 'cursive'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'shake': 'shake 0.5s ease-in-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'chalk-draw': 'chalkDraw 0.5s ease-out forwards',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        chalkDraw: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'chalk': '0 0 10px rgba(245, 245, 245, 0.3)',
        'warning': '0 0 20px rgba(230, 57, 70, 0.5)',
      },
    },
  },
  plugins: [],
};
