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
        base: {
          950: "#0A0A0C",
          900: "#0F0F12",
          850: "#15151A",
          800: "#1A1A20",
          700: "#2A2A33",
          600: "#3A3A47",
          500: "#5A5A6B",
        },
        neon: {
          red: "#FF3366",
          green: "#00FF88",
          orange: "#FFAA00",
          purple: "#AA55FF",
          cyan: "#00EEFF",
          pink: "#FF55AA",
        },
      },
      fontFamily: {
        display: ['"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glitch': 'glitch 0.3s ease-in-out',
        'scanline': 'scanline 6s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px currentColor, 0 0 10px currentColor' },
          '100%': { boxShadow: '0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor' },
        },
      },
      boxShadow: {
        'neon-red': '0 0 10px #FF3366, 0 0 20px rgba(255, 51, 102, 0.5)',
        'neon-green': '0 0 10px #00FF88, 0 0 20px rgba(0, 255, 136, 0.5)',
        'neon-orange': '0 0 10px #FFAA00, 0 0 20px rgba(255, 170, 0, 0.5)',
        'neon-purple': '0 0 10px #AA55FF, 0 0 20px rgba(170, 85, 255, 0.5)',
      },
    },
  },
  plugins: [],
};
