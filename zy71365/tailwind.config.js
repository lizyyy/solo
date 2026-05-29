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
        charcoal: {
          50: '#f5f5f5',
          100: '#e0e0e0',
          200: '#b8b8b8',
          300: '#8a8a8a',
          400: '#5c5c5c',
          500: '#3d3d3d',
          600: '#2e2e2e',
          700: '#242424',
          800: '#1a1a1a',
          900: '#121212',
        },
        cream: {
          50: '#fdfcfa',
          100: '#f9f6f0',
          200: '#f5f0e8',
          300: '#e8dfd0',
          400: '#d4c7b0',
          500: '#b8a88c',
        },
        ochre: {
          400: '#e08a30',
          500: '#d17a22',
          600: '#b86818',
          700: '#965410',
        },
        moss: {
          500: '#5A7247',
          600: '#4a5f3a',
        },
        terracotta: {
          500: '#B84A3E',
          600: '#9a3c32',
        },
        slateblue: {
          400: '#7d8e97',
          500: '#6B7C85',
          600: '#5a6a72',
        }
      },
      fontFamily: {
        display: ['Lora', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'paper-texture': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        'warm-gradient': 'linear-gradient(135deg, rgba(209,122,34,0.1) 0%, rgba(184,74,62,0.05) 100%)',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        pulseSoft: 'pulseSoft 2s ease-in-out infinite',
        fadeInUp: 'fadeInUp 0.4s ease-out forwards',
        slideIn: 'slideIn 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
};
