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
        space: {
          950: '#0a1628',
          900: '#0f1f38',
          800: '#162a4a',
          700: '#1e3a5f',
        },
        tech: {
          cyan: '#00d4ff',
          orange: '#ff9500',
          red: '#ff3b30',
          green: '#34c759',
        }
      },
      fontFamily: {
        orbitron: ['Orbitron', 'monospace'],
        mono: ['Roboto Mono', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 2s linear infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
};
