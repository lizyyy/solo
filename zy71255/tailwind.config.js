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
          DEFAULT: '#0A1628',
          50: '#1A3A5C',
          100: '#153050',
          200: '#102644',
          300: '#0B1C38',
          400: '#0A1628',
          500: '#081220',
          600: '#060E18',
          700: '#040A10',
          800: '#020608',
          900: '#000000',
        },
        accent: {
          green: '#00FF9D',
          orange: '#FF8A00',
          red: '#FF3B3B',
          purple: '#9D4EDD',
          cyan: '#00D4FF',
        },
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0, 255, 157, 0.5)',
        'glow-orange': '0 0 20px rgba(255, 138, 0, 0.5)',
        'glow-red': '0 0 20px rgba(255, 59, 59, 0.5)',
        'glow-purple': '0 0 20px rgba(157, 78, 221, 0.5)',
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breath': 'breath 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        breath: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px currentColor' },
          '50%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
      },
    },
  },
  plugins: [],
};
