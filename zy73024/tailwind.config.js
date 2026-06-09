/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        clay: {
          DEFAULT: '#C87941',
          50: '#FBF2EA',
          100: '#F4E0CE',
          200: '#E8C29F',
          300: '#DDA070',
          400: '#D38655',
          500: '#C87941',
          600: '#A76231',
          700: '#824A24',
          800: '#5D3518',
          900: '#3A200E',
        },
        sage: {
          DEFAULT: '#8FA68C',
          50: '#F1F4F0',
          100: '#DDE6DC',
          200: '#BCCDB9',
          300: '#9BB597',
          400: '#8FA68C',
          500: '#6E8A69',
          600: '#546B50',
          700: '#3E4D3B',
          800: '#283027',
          900: '#141813',
        },
        rust: {
          DEFAULT: '#B5523A',
          50: '#FBEDEA',
          100: '#F5D5CE',
          200: '#E9AB9D',
          300: '#DD816C',
          400: '#D05C3F',
          500: '#B5523A',
          600: '#8E402D',
          700: '#682F21',
          800: '#421D15',
          900: '#210E0A',
        },
        graphite: {
          DEFAULT: '#565264',
          50: '#EDECFA',
          100: '#D1CFE3',
          200: '#A5A0C7',
          300: '#7871AA',
          400: '#5C5681',
          500: '#565264',
          600: '#42404E',
          700: '#31303A',
          800: '#212028',
          900: '#101014',
        },
        paper: {
          DEFAULT: '#FAF7F2',
          deep: '#F2EDE2'
        }
      },
      fontFamily: {
        kai: ['"LXGW WenKai"', '"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        'card': '0 4px 14px -2px rgba(200, 121, 65, 0.15)',
        'card-hover': '0 8px 24px -4px rgba(200, 121, 65, 0.25)',
        'btn': '0 2px 0 rgba(131, 74, 36, 0.35)'
      },
      keyframes: {
        'draw-line': {
          'to': { 'stroke-dashoffset': '0' }
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'pulse-badge': {
          '0%, 100%': { 'box-shadow': '0 0 0 0 rgba(181, 82, 58, 0.6)' },
          '50%': { 'box-shadow': '0 0 0 8px rgba(181, 82, 58, 0)' }
        },
        'zoom-in': {
          '0%': { transform: 'scale(0.98)', opacity: '0.92' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        'slide-right': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        }
      },
      animation: {
        'draw-line': 'draw-line 0.8s ease-out forwards',
        'fade-up': 'fade-up 0.5s ease-out both',
        'pulse-badge': 'pulse-badge 1.6s ease-in-out 3',
        'zoom-in': 'zoom-in 0.4s ease-out',
        'slide-right': 'slide-right 0.5s ease-out both'
      }
    }
  },
  plugins: []
}
