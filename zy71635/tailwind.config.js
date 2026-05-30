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
        hall: {
          bg: '#0d0d1a',
          surface: '#1a1a2e',
          panel: 'rgba(26, 26, 46, 0.85)',
          border: 'rgba(212, 168, 83, 0.2)',
          amber: '#d4a853',
          amberLight: '#e8c97a',
          amberDark: '#b08930',
          steel: '#4a90d9',
          danger: '#e74c3c',
          dangerBg: 'rgba(231, 76, 60, 0.1)',
          warn: '#f39c12',
          warnBg: 'rgba(243, 156, 18, 0.1)',
          info: '#4a90d9',
          infoBg: 'rgba(74, 144, 217, 0.1)',
          muted: '#6b7280',
          text: '#e5e7eb',
          textDim: '#9ca3af',
        }
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(212, 168, 83, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(212, 168, 83, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
