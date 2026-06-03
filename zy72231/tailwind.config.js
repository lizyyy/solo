/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        sans: ['Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        navy: {
          900: '#0A1219',
          800: '#0F1923',
          700: '#1A2B3C',
          600: '#2A3B4C',
        },
        success: '#00D68F',
        warning: '#FFAA00',
        danger: '#FF6B6B',
      },
    },
  },
  plugins: [],
};
