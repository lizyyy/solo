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
        neon: '#00FF88',
        'neon-dim': '#00CC6A',
        'neon-glow': 'rgba(0, 255, 136, 0.15)',
        danger: '#FF3355',
        warning: '#FFAA00',
        surface: {
          DEFAULT: '#0F0F0F',
          card: '#1A1A1A',
          elevated: '#252525',
          border: '#333333',
        },
        muted: '#888888',
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 12px rgba(0, 255, 136, 0.3), 0 0 4px rgba(0, 255, 136, 0.2)',
        'neon-sm': '0 0 6px rgba(0, 255, 136, 0.2)',
      },
    },
  },
  plugins: [],
};
