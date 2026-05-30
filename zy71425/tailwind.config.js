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
        'space-deep': '#0A1628',
        'space-dark': '#0F1D35',
        'space-medium': '#1A2D4A',
        'plasma-blue': '#00D4FF',
        'plasma-cyan': '#00F5FF',
        'magnetic-purple': '#9D4EDD',
        'magnetic-violet': '#7B2CBF',
        'energy-red': '#FF4D6D',
        'energy-orange': '#FF8C42',
        'neon-green': '#39FF14',
        'tech-gray': '#4A5568',
        'tech-light': '#718096',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(0, 212, 255, 0.5)',
        'glow-purple': '0 0 20px rgba(157, 78, 221, 0.5)',
        'glow-green': '0 0 20px rgba(57, 255, 20, 0.5)',
        'glow-red': '0 0 20px rgba(255, 77, 109, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 212, 255, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.8)' },
        },
      },
    },
  },
  plugins: [],
};
