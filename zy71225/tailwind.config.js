/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bloomberg': {
          bg: '#0B1E14',
          panel: '#0F2819',
          border: '#1A3D2A',
          text: '#E8F5EE',
          muted: '#8BA99A',
        },
        'trader': {
          green: '#2ECC71',
          red: '#E63946',
        },
        'warning': {
          orange: '#FF9F1C',
        },
        'highlight': {
          yellow: '#FFE066',
          blue: '#4EA8DE',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        hand: ['Caveat', 'cursive'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shake': 'shake 0.5s ease-in-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(230, 57, 70, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(230, 57, 70, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
