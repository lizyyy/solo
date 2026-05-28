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
        space: {
          50: '#E6F1FF',
          100: '#B3D4FF',
          200: '#80B7FF',
          300: '#4D9AFF',
          400: '#1A7DFF',
          500: '#0A192F',
          600: '#081020',
          700: '#060C18',
          800: '#040810',
          900: '#020408',
        },
        tech: {
          50: '#E0FFF8',
          100: '#B3FFEB',
          200: '#80FFDC',
          300: '#4DFFCD',
          400: '#1AFFBE',
          500: '#64FFDA',
          600: '#00CC96',
          700: '#009971',
          800: '#00664B',
          900: '#003326',
        },
        alert: {
          yellow: '#FFB703',
          red: '#FF6B6B',
        }
      },
      fontFamily: {
        orbitron: ['Orbitron', 'monospace'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'scan': 'scan 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px #64FFDA, 0 0 10px #64FFDA' },
          '100%': { boxShadow: '0 0 20px #64FFDA, 0 0 30px #64FFDA' },
        }
      }
    },
  },
  plugins: [],
};
