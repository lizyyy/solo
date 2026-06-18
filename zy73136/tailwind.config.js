/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'deep-ocean': '#0A1628',
        'ocean-blue': '#1E3A5F',
        'ocean-light': '#2A4A7A',
        'cyan-glow': '#00D4FF',
        'cyan-dim': '#0099BB',
        'anomaly-red': '#FF4757',
        'warning-orange': '#FFA502',
        'normal-green': '#2ED573',
        'panel-bg': 'rgba(30, 58, 95, 0.85)',
        'panel-border': 'rgba(0, 212, 255, 0.3)',
      },
      fontFamily: {
        'orbitron': ['Orbitron', 'sans-serif'],
        'roboto-mono': ['Roboto Mono', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0, 212, 255, 0.5)',
        'glow-red': '0 0 20px rgba(255, 71, 87, 0.5)',
        'glow-orange': '0 0 15px rgba(255, 165, 2, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 212, 255, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 212, 255, 0.7)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
};
