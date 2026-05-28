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
        'rock-dark': '#1a1a2e',
        'rock-darker': '#0f0f1a',
        'neon-pink': '#e94560',
        'neon-cyan': '#00d4ff',
        'neon-blue': '#0f3460',
        'neon-purple': '#9d4edd',
        'warning-orange': '#ff9a3c',
        'success-green': '#4ade80',
        'danger-red': '#ef4444',
        'rock-gray': '#2d2d44',
        'rock-light': '#3d3d5c',
      },
      fontFamily: {
        'rock': ['"Permanent Marker"', 'cursive'],
        'body': ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-pink': '0 0 5px #e94560, 0 0 20px rgba(233, 69, 96, 0.5)',
        'neon-cyan': '0 0 5px #00d4ff, 0 0 20px rgba(0, 212, 255, 0.5)',
        'neon-orange': '0 0 5px #ff9a3c, 0 0 20px rgba(255, 154, 60, 0.5)',
      },
      animation: {
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
        'glow': 'glow 1.5s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'glow': {
          'from': { boxShadow: '0 0 5px #e94560, 0 0 20px rgba(233, 69, 96, 0.5)' },
          'to': { boxShadow: '0 0 10px #e94560, 0 0 40px rgba(233, 69, 96, 0.8)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.1'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
