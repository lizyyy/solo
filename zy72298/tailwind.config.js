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
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#1e3a5f',
          900: '#102a43',
        },
        industrial: {
          blue: '#1e3a5f',
          orange: '#e67e22',
          green: '#27ae60',
          red: '#c0392b',
          gray: '#34495e',
        }
      },
      fontFamily: {
        display: ['"Roboto Condensed"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(30, 58, 95, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 58, 95, 0.05) 1px, transparent 1px)",
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
      animation: {
        'pulse-orange': 'pulseOrange 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        pulseOrange: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(230, 126, 34, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(230, 126, 34, 0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
