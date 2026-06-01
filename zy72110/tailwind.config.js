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
        harbor: {
          bg: '#0f1923',
          panel: '#1a2332',
          card: '#1e2d3d',
          border: '#2a3a4e',
          amber: '#f0a500',
          'amber-dim': '#b87d00',
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
        },
      },
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px currentColor' },
          '100%': { boxShadow: '0 0 20px currentColor, 0 0 40px currentColor' },
        },
      },
    },
  },
  plugins: [],
};
