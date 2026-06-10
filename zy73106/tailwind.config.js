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
        steel: {
          50: '#F5F7FA',
          100: '#E4E9F0',
          200: '#C8D1DC',
          300: '#9AABB9',
          400: '#6D8092',
          500: '#4A5D70',
          600: '#354556',
          700: '#253342',
          800: '#1E2A3A',
          900: '#151D29',
          950: '#0E1319',
        },
        blueprint: {
          red: '#C0392B',
          orange: '#E67E22',
          green: '#27AE60',
          yellow: '#F1C40F',
        },
        paper: {
          yellow: '#F5F0E1',
          cream: '#FAF7EF',
        }
      },
      fontFamily: {
        display: ['"Archivo Black"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'stamp': 'inset 2px 2px 0 rgba(0,0,0,0.3), inset -1px -1px 0 rgba(255,255,255,0.15)',
        'panel': '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      animation: {
        'stamp-in': 'stampIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'slide-right': 'slideRight 0.4s ease-out',
        'flash-orange': 'flashOrange 1.2s ease-in-out 3',
        'blueprint-draw': 'blueprintDraw 0.8s ease-out',
        'number-pop': 'numberPop 0.5s ease-out',
      },
      keyframes: {
        stampIn: {
          '0%': { transform: 'scale(2) rotate(-15deg)', opacity: '0' },
          '60%': { transform: 'scale(0.9) rotate(2deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(40px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        flashOrange: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(230, 126, 34, 0.35)' },
        },
        blueprintDraw: {
          '0%': { clipPath: 'inset(0 0 100% 0)' },
          '100%': { clipPath: 'inset(0 0 0% 0)' },
        },
        numberPop: {
          '0%': { transform: 'scale(1)', backgroundColor: 'transparent' },
          '50%': { transform: 'scale(1.15)', backgroundColor: 'rgba(241, 196, 15, 0.35)' },
          '100%': { transform: 'scale(1)', backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
};
