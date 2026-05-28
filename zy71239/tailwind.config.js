/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'navy': {
          50: '#e6eaf2',
          100: '#b3c1d9',
          200: '#8099c0',
          300: '#4d71a7',
          400: '#1a498e',
          500: '#0A2463',
          600: '#081d4f',
          700: '#06163b',
          800: '#040e27',
          900: '#020713',
        },
        'warning': '#E63946',
        'success': '#2A9D8F',
        'vip': '#F4A261',
      },
      fontFamily: {
        'sans': ['Noto Sans SC', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
        'slide-in': 'slideIn 0.3s ease-out',
        'scan-line': 'scanLine 1.5s ease-in-out infinite',
      },
      keyframes: {
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scanLine: {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
