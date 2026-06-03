/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'finance': {
          50: '#f0f4ff',
          100: '#e0e8ff',
          200: '#c7d3fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#4F46E5',
          600: '#1E3A8A',
          700: '#1e3a8a',
          800: '#1e3a8a',
          900: '#1e3a8a',
        },
        'alert': {
          500: '#DC2626',
          600: '#b91c1c',
        },
        'success': {
          500: '#059669',
          600: '#047857',
        },
        'warning': {
          500: '#D97706',
          600: '#b45309',
        }
      },
      fontFamily: {
        'serif-sc': ['"Noto Serif SC"', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(220, 38, 38, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(220, 38, 38, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
