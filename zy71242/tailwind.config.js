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
        wood: {
          50: '#F5E6C8',
          100: '#EED9B6',
          200: '#DCC497',
          300: '#C9A84C',
          400: '#B8934A',
          500: '#8B6914',
          600: '#5C4A1E',
          700: '#3D2E14',
          800: '#2C1810',
          900: '#1A0E08',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light: '#E0C878',
          dark: '#9A7B30',
        },
        parchment: {
          DEFAULT: '#F5E6C8',
          dark: '#E8D4A8',
          darker: '#D4BF8E',
        },
        ink: {
          DEFAULT: '#2C1810',
          light: '#4A3728',
        },
        seal: {
          DEFAULT: '#8B2500',
          light: '#A83420',
        },
        jade: {
          DEFAULT: '#2D4A3E',
          light: '#3D6A56',
        },
        plum: {
          DEFAULT: '#5B4A8A',
          light: '#7A6AAA',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Noto Serif SC', 'Georgia', 'serif'],
        body: ['Cormorant Garamond', 'Noto Serif SC', 'Georgia', 'serif'],
      },
      animation: {
        'gavel-slam': 'gavelSlam 0.5s ease-in-out',
        'price-flip': 'priceFlip 0.3s ease-out',
        'float-in': 'floatIn 0.5s ease-out',
        'shimmer': 'shimmer 2s infinite',
        'pulse-gold': 'pulseGold 2s infinite',
      },
      keyframes: {
        gavelSlam: {
          '0%': { transform: 'rotate(-30deg) translateY(-20px)' },
          '50%': { transform: 'rotate(5deg) translateY(0)' },
          '70%': { transform: 'rotate(-3deg) translateY(-5px)' },
          '100%': { transform: 'rotate(0deg) translateY(0)' },
        },
        priceFlip: {
          '0%': { transform: 'rotateX(90deg)', opacity: 0 },
          '100%': { transform: 'rotateX(0deg)', opacity: 1 },
        },
        floatIn: {
          '0%': { transform: 'translateY(20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201, 168, 76, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(201, 168, 76, 0)' },
        },
      },
      backgroundImage: {
        'wood-grain': 'repeating-linear-gradient(90deg, rgba(44,24,16,0.03) 0px, rgba(44,24,16,0.06) 1px, transparent 1px, transparent 3px)',
        'parchment-texture': 'radial-gradient(ellipse at 20% 50%, rgba(201,168,76,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,37,0,0.05) 0%, transparent 50%)',
      },
    },
  },
  plugins: [],
};
