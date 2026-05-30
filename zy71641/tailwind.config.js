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
        'golf-bg': '#0B0F17',
        'golf-bg-light': '#141B26',
        'golf-bg-lighter': '#1E2736',
        'golf-border': '#2A3547',
        'golf-text': '#E2E8F0',
        'golf-text-muted': '#94A3B8',
        'golf-text-dim': '#64748B',
        'golf-green': '#00FF88',
        'golf-orange': '#FF8800',
        'golf-blue': '#00AAFF',
        'golf-red': '#FF3366',
        'golf-purple': '#AA66FF',
        'golf-yellow': '#FFDD00',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-green': '0 0 20px rgba(0, 255, 136, 0.3)',
        'neon-orange': '0 0 20px rgba(255, 136, 0, 0.3)',
        'neon-blue': '0 0 20px rgba(0, 170, 255, 0.3)',
        'neon-red': '0 0 20px rgba(255, 51, 102, 0.3)',
        'neon-purple': '0 0 20px rgba(170, 102, 255, 0.3)',
        'neon-yellow': '0 0 20px rgba(255, 221, 0, 0.3)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'shake': 'shake 0.5s ease-in-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px currentColor' },
          '100%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
    },
  },
  plugins: [],
};
