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
        detective: {
          bg: '#0f172a',
          bgLight: '#1e293b',
          bgLighter: '#334155',
          accent: '#f59e0b',
          accentLight: '#fbbf24',
          danger: '#dc2626',
          dangerLight: '#ef4444',
          success: '#10b981',
          successLight: '#34d399',
          warning: '#f59e0b',
          paper: '#fef3c7',
          paperDark: '#fde68a'
        }
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'sans-serif']
      },
      animation: {
        'stamp': 'stamp 0.3s ease-out',
        'shake': 'shake 0.5s ease-in-out',
        'glow': 'glow 2s ease-in-out infinite',
        'slide-in-left': 'slideInLeft 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'highlight-pulse': 'highlightPulse 1.5s ease-in-out'
      },
      keyframes: {
        stamp: {
          '0%': { transform: 'scale(2)', opacity: '0' },
          '50%': { transform: 'scale(1.2)', opacity: '0.8' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' }
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(245, 158, 11, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(245, 158, 11, 0.8)' }
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-50px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        slideInRight: {
          '0%': { transform: 'translateX(50px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        highlightPulse: {
          '0%, 100%': { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
          '50%': { backgroundColor: 'rgba(245, 158, 11, 0.5)' }
        }
      }
    },
  },
  plugins: [],
};
