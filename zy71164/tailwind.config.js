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
        'sonar-bg': '#0a1a0a',
        'sonar-dark': '#1a2f1a',
        'sonar-mid': '#2a4a2a',
        'sonar-green': '#39ff14',
        'sonar-amber': '#ffb000',
        'sonar-red': '#ff3333',
        'sonar-cyan': '#00ffff',
        'sonar-grid': '#1a3a1a',
      },
      fontFamily: {
        'vt323': ['VT323', 'monospace'],
        'jetbrains': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'scanline': 'scanline 6s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'radar-sweep': 'radar-sweep 2s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.95' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px #39ff14, 0 0 10px #39ff14' },
          '50%': { boxShadow: '0 0 20px #39ff14, 0 0 30px #39ff14' },
        },
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
};
