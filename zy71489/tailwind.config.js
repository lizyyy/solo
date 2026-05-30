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
        bg: "var(--color-bg)",
        gold: "var(--color-gold)",
        red: "var(--color-red)",
        orange: "var(--color-orange)",
      },
      fontFamily: {
        serif: ["Noto Serif SC", "serif"],
        sans: ["Noto Sans SC", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        'stage': '8px',
      },
      boxShadow: {
        'glow': '0 0 15px rgba(212, 175, 55, 0.3)',
        'glow-hover': '0 0 25px rgba(212, 175, 55, 0.5)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 25px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'pulse-red': 'pulse-red 2s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'count-up': 'count-up 0.6s ease-out',
      },
      keyframes: {
        'pulse-red': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(229, 57, 53, 0.7)' },
          '50%': { opacity: '0.7', boxShadow: '0 0 0 10px rgba(229, 57, 53, 0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
