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
          900: '#0d1117',
          800: '#131825',
          700: '#1a1f36',
          600: '#242940',
          500: '#2d3348',
        },
        accent: {
          DEFAULT: '#00d4ff',
          dim: '#0099bb',
          glow: 'rgba(0, 212, 255, 0.15)',
        },
        danger: {
          DEFAULT: '#ff4757',
          dim: '#cc3945',
          glow: 'rgba(255, 71, 87, 0.15)',
        },
        safe: {
          DEFAULT: '#2ed573',
          dim: '#25aa5c',
          glow: 'rgba(46, 213, 115, 0.15)',
        },
        warn: {
          DEFAULT: '#ffa502',
          dim: '#cc8402',
          glow: 'rgba(255, 165, 2, 0.15)',
        },
        muted: '#8b95a5',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
