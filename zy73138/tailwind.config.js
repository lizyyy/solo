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
        ocean: {
          900: '#0A2540',
          800: '#0D3158',
          700: '#123E6E',
          600: '#1A4F8B',
          500: '#2563A8',
        },
        tide: {
          DEFAULT: '#00BFA5',
          light: '#33CCB8',
          dark: '#009E8A',
        },
        rust: {
          DEFAULT: '#E8653A',
          light: '#F08050',
          dark: '#C54E28',
        },
        sand: {
          DEFAULT: '#D4A843',
          light: '#E0BE6B',
          dark: '#B8902E',
        },
        foam: {
          DEFAULT: '#F0F4F8',
          dark: '#D8E0E8',
        },
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'serif'],
        sans: ['Noto Sans SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
