/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-border': 'pulseBorder 2s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseBorder: {
          '0%, 100%': { borderColor: 'rgba(231, 76, 60, 0.3)' },
          '50%': { borderColor: 'rgba(231, 76, 60, 0.8)' },
        },
      },
    },
  },
  plugins: [],
};
