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
          50: '#E8ECF4',
          100: '#C5CFE5',
          200: '#9EB0D4',
          300: '#7791C3',
          400: '#5A78B6',
          500: '#3D5FA9',
          600: '#3757A1',
          700: '#2E4B96',
          800: '#0A2463',
          900: '#1A2E6B',
        },
        gold: {
          50: '#FBF7E7',
          100: '#F5EAC4',
          200: '#EEDC9D',
          300: '#E6CD75',
          400: '#E1C258',
          500: '#D4AF37',
          600: '#C49F33',
          700: '#B08B2D',
          800: '#9D7827',
          900: '#7B5A1D',
        },
        liquidity: {
          good: '#2ECC71',
          warning: '#F39C12',
          danger: '#E74C3C',
        },
        tentative: {
          bg: 'rgba(127, 140, 141, 0.15)',
          text: '#7F8C8D',
        }
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'ripple': 'ripple 0.6s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
