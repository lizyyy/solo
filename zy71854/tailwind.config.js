/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'space-deep': '#0B2545',
        'space-dark': '#13315C',
        'space-blue': '#134074',
        'space-light': '#8DA9C4',
        'star-gold': '#D4AF37',
        'star-light': '#EEB868',
        'graphite': '#2D3748',
        'graphite-light': '#4A5568',
        'status-confirmed': '#22C55E',
        'status-pending': '#F97316',
        'status-modified': '#A855F7',
      },
      fontFamily: {
        'serif': ['"Noto Serif SC"', 'serif'],
        'sans': ['"Noto Sans SC"', 'sans-serif'],
      },
      animation: {
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 0.5s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(212, 175, 55, 0.3)' },
        },
        slideLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
