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
        ocean: {
          950: '#0A2540',
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
        neon: {
          DEFAULT: '#00E5A0',
          500: '#00E5A0',
          600: '#00CC8F',
        },
        alert: {
          DEFAULT: '#FF6B35',
          500: '#FF6B35',
          600: '#E85A24',
        },
        muted: {
          DEFAULT: '#94A3B8',
          500: '#94A3B8',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          50: '#F8FAFC',
        }
      },
      fontFamily: {
        sans: ['Source Sans 3', 'system-ui', 'sans-serif'],
        display: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'count-up': 'countUp 0.6s ease-out',
      },
      keyframes: {
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
};
