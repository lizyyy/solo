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
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
      colors: {
        'chip-bg': '#0a0e17',
        'chip-panel': 'rgba(0, 0, 0, 0.6)',
        'chip-border': 'rgba(255, 255, 255, 0.05)',
        'cyan-neon': '#00ffd5',
        'orange-neon': '#ff6b35',
        'purple-neon': '#c084fc',
        'pink-neon': '#f472b6',
        'red-error': '#ff2d55',
        'green-safe': '#22c55e',
      },
    },
  },
  plugins: [],
};
