/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef4fb',
          100: '#d9e4f2',
          200: '#b8cde6',
          300: '#8cadd5',
          400: '#6089c0',
          500: '#406eaa',
          600: '#2f568c',
          700: '#284673',
          800: '#253c60',
          900: '#1e3a5f',
        },
        accent: {
          orange: '#f59e0b',
          green: '#10b981',
          red: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(239, 68, 68, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(239, 68, 68, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}
