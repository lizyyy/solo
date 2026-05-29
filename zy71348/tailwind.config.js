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
        vinyl: {
          '900': '#0d1f1b',
          '800': '#142e27',
          '700': '#1a3c34',
          '600': '#214a41',
          '500': '#2d5a50',
        },
        caramel: {
          '100': '#f3e6d8',
          '200': '#e7ccb1',
          '300': '#dbb28a',
          '400': '#d4a574',
          '500': '#c48a50',
        },
        cream: {
          '50': '#faf7f2',
          '100': '#f5f0e8',
          '200': '#ebe0ce',
        },
        alert: {
          '500': '#c0392b',
          '600': '#a93226',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Source Sans Pro"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'vinyl': '0 4px 6px -1px rgba(26, 60, 52, 0.2), 0 2px 4px -1px rgba(26, 60, 52, 0.1)',
        'vinyl-lg': '0 10px 15px -3px rgba(26, 60, 52, 0.2), 0 4px 6px -2px rgba(26, 60, 52, 0.1)',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
