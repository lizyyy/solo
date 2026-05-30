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
        'space': {
          900: '#0a1628',
          800: '#0f1f38',
          700: '#1a2d4a',
          600: '#243b5c',
        },
        'cyber': {
          500: '#00d4ff',
          400: '#33ddff',
          600: '#00a8cc',
        },
        'warning': {
          500: '#ff6b35',
          400: '#ff885c',
        },
        'danger': {
          500: '#ff3366',
          400: '#ff5c85',
        },
      },
      fontFamily: {
        'orbitron': ['Orbitron', 'monospace'],
        'jetbrains': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px #00d4ff, 0 0 10px #00d4ff' },
          '50%': { boxShadow: '0 0 20px #00d4ff, 0 0 30px #00d4ff' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        'cyber-glow': '0 0 15px rgba(0, 212, 255, 0.5)',
        'danger-glow': '0 0 15px rgba(255, 51, 102, 0.5)',
      },
    },
  },
  plugins: [],
};
