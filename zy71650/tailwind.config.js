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
        'synth-bg': '#0F1117',
        'synth-card': '#1A1D2E',
        'synth-green': '#39FF14',
        'synth-accent': '#39FF14',
        'synth-amber': '#FFB800',
        'synth-selected': '#2D1B4E',
        'synth-border': '#2A2D3E',
        'synth-muted': '#6B7280',
      },
      fontFamily: {
        'mono-display': ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(57, 255, 20, 0.3)',
        'glow-amber': '0 0 20px rgba(255, 184, 0, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
