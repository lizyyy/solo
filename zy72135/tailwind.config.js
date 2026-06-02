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
        slate: {
          800: '#1e3a5f',
          850: '#1a2f4a',
          900: '#142538',
        },
        amber: {
          500: '#d4a574',
          450: '#e0b88a',
          600: '#b8915e',
        },
        warm: {
          50: '#faf8f5',
          100: '#f5f2ed',
          200: '#e8e4de',
        },
        charcoal: {
          500: '#2c3e50',
          600: '#233140',
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['Lora', 'serif'],
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      transitionDelay: {
        '80': '80ms',
        '160': '160ms',
        '240': '240ms',
        '320': '320ms',
      },
    },
  },
  plugins: [],
};
