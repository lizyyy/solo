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
          50: '#E6F0FF',
          100: '#CCE0FF',
          200: '#99C2FF',
          300: '#66A3FF',
          400: '#3385FF',
          500: '#165DFF',
          600: '#0E4BD6',
          700: '#0A3AA3',
          800: '#072970',
          900: '#03183D',
        },
        warning: {
          50: '#FFF7E6',
          100: '#FFEFBF',
          200: '#FFDF80',
          300: '#FFCF40',
          400: '#FFBF00',
          500: '#FFC53D',
          600: '#CC9E31',
          700: '#997625',
          800: '#664F19',
          900: '#33270C',
        },
        danger: {
          50: '#FFEBE6',
          100: '#FFD6BF',
          200: '#FFAD80',
          300: '#FF8540',
          400: '#FF5C00',
          500: '#FF7D00',
          600: '#CC6400',
          700: '#994B00',
          800: '#663200',
          900: '#331900',
        },
        success: {
          50: '#E6FFF0',
          100: '#BFFFD4',
          200: '#80FFAA',
          300: '#40FF7F',
          400: '#00FF55',
          500: '#00B42A',
          600: '#009022',
          700: '#006C19',
          800: '#004811',
          900: '#002408',
        },
        dark: {
          50: '#F2F3F5',
          100: '#E5E6EB',
          200: '#C9CDD4',
          300: '#86909C',
          400: '#4E5969',
          500: '#272E3B',
          600: '#1D2129',
          700: '#171A21',
          800: '#0F1218',
          900: '#0A0C10',
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'stagger-in': 'staggerIn 0.5s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(22, 93, 255, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(22, 93, 255, 0.8)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        staggerIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
