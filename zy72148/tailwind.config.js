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
          50: '#f0f7f9',
          100: '#d9edf1',
          200: '#b3dbe4',
          300: '#84c3d2',
          400: '#4ea5ba',
          500: '#2f879e',
          600: '#286c83',
          700: '#26586b',
          800: '#254959',
          900: '#0F4C5C',
          950: '#08303a',
        },
        accent: {
          50: '#fff4ed',
          100: '#ffe6d6',
          200: '#ffc9ad',
          300: '#ffa478',
          400: '#ff7442',
          500: '#E36414',
          600: '#d44a0a',
          700: '#b0370b',
          800: '#8c2e10',
          900: '#722810',
        },
        cream: {
          50: '#fdfcfb',
          100: '#FBF7F4',
          200: '#f5ede7',
          300: '#ecddd3',
          400: '#e0c9bb',
        },
        warning: {
          100: '#fef3c7',
          500: '#f59e0b',
        },
        error: {
          100: '#fee2e2',
          500: '#ef4444',
        },
        info: {
          100: '#dbeafe',
          500: '#3b82f6',
        }
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'check': 'check 0.3s ease-in-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        check: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.2)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
