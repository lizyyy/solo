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
        lab: {
          bg: '#0a0e1a',
          surface: '#111827',
          panel: '#1a1f35',
          border: '#2a3050',
          glow: '#00ffd5',
          amber: '#ff9f1c',
          text: '#e2e8f0',
          muted: '#64748b',
          danger: '#ef4444',
          warning: '#f59e0b',
          success: '#10b981',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 255, 213, 0.3)',
        'glow-amber': '0 0 20px rgba(255, 159, 28, 0.3)',
        'glow-sm': '0 0 10px rgba(0, 255, 213, 0.2)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 255, 213, 0.2)' },
          '50%': { boxShadow: '0 0 25px rgba(0, 255, 213, 0.5)' },
        }
      }
    },
  },
  plugins: [],
};
