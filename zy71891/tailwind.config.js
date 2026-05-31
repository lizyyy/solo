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
          50: '#E8F3FF',
          100: '#B9DBFF',
          200: '#8CBEFF',
          300: '#5EA2FF',
          400: '#3085FF',
          500: '#165DFF',
          600: '#0E42D2',
          700: '#0A2BA0',
          800: '#061A6E',
          900: '#030D3C',
        },
        warning: {
          50: '#FFF7E8',
          100: '#FFE7BA',
          200: '#FFD78C',
          300: '#FFC75E',
          400: '#FFB730',
          500: '#FF7D00',
          600: '#D25F00',
          700: '#A04500',
          800: '#6E2E00',
          900: '#3C1900',
        },
        danger: {
          50: '#FFECE8',
          100: '#FDCDC5',
          200: '#FBACA3',
          300: '#F98B81',
          400: '#F76A5F',
          500: '#F53F3F',
          600: '#CB2634',
          700: '#A11229',
          800: '#77071E',
          900: '#4D0313',
        },
        success: {
          50: '#E8FFEA',
          100: '#BAFFC0',
          200: '#8CFF97',
          300: '#5EFF6E',
          400: '#30FF45',
          500: '#00B42A',
          600: '#009A29',
          700: '#007D26',
          800: '#005F20',
          900: '#004219',
        },
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.3s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
