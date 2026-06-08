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
        brand: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#95D5B2',
          400: '#52B788',
          500: '#2D6A4F',
          600: '#1B4332',
          700: '#14532d',
          800: '#14532d',
          900: '#052e16',
        },
        warn: {
          400: '#F4A261',
          500: '#E76F51',
          600: '#DC5A3E',
        },
        accent: {
          300: '#E9C46A',
          400: '#E0AE3E',
          500: '#D4A017',
        },
        ink: {
          50: '#FAFAF7',
          100: '#F5F5EF',
          200: '#E8E6DE',
          300: '#B7B4A8',
          500: '#5A564A',
          700: '#264653',
          900: '#1A1A1A',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 20px -8px rgba(27, 67, 50, 0.12)',
        card: '0 8px 32px -12px rgba(27, 67, 50, 0.18)',
        glow: '0 0 0 3px rgba(149, 213, 178, 0.35)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out both',
        'pulse-soft': 'pulseSoft 2.2s ease-in-out infinite',
        'slide-down': 'slideDown 0.3s ease-out both',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(231, 111, 81, 0.4)' },
          '50%': { opacity: '0.92', boxShadow: '0 0 0 8px rgba(231, 111, 81, 0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
