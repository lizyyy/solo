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
          50: '#E6F8F5',
          100: '#B3EDE3',
          200: '#80E1D1',
          300: '#4DD5BF',
          400: '#1AC9AD',
          500: '#00F5D4',
          600: '#00C4A9',
          700: '#00937F',
          800: '#006254',
          900: '#00312A',
        },
        accent: {
          50: '#FFF5E6',
          100: '#FFE4B3',
          200: '#FFD380',
          300: '#FFC24D',
          400: '#FFB11A',
          500: '#FF9F1C',
          600: '#CC7F16',
          700: '#995F11',
          800: '#66400B',
          900: '#332006',
        },
        purple: {
          50: '#F4ECFB',
          100: '#DEC4F2',
          200: '#C89CE9',
          300: '#B274E0',
          400: '#9C4CD7',
          500: '#9D4EDD',
          600: '#7E3EB1',
          700: '#5E2F85',
          800: '#3F1F58',
          900: '#1F102C',
        },
        dark: {
          50: '#E8EAED',
          100: '#B9BFC9',
          200: '#8A94A5',
          300: '#5B6981',
          400: '#2C3E5D',
          500: '#0A1628',
          600: '#081220',
          700: '#060D18',
          800: '#040910',
          900: '#020408',
        },
        status: {
          confirmed: '#10B981',
          tentative: '#F59E0B',
          noise: '#EF4444',
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'wave': 'wave 1.5s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 245, 212, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 245, 212, 0.8)' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(1.2)' },
        }
      }
    },
  },
  plugins: [],
};
