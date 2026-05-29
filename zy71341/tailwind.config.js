/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          blue: '#00F0FF',
          orange: '#FF6B35',
          red: '#FF3366',
          green: '#00FF88',
        },
        dark: {
          900: '#0A0A0F',
          800: '#12121A',
          700: '#1A1A25',
          600: '#252532',
          500: '#32324A',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'neon-blue': '0 0 20px rgba(0, 240, 255, 0.3)',
        'neon-orange': '0 0 20px rgba(255, 107, 53, 0.3)',
        'neon-red': '0 0 20px rgba(255, 51, 102, 0.3)',
        'neon-green': '0 0 20px rgba(0, 255, 136, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px currentColor' },
          '100%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        }
      }
    },
  },
  plugins: [],
}
