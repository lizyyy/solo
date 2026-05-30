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
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        'navy-dark': '#060E1A',
        'navy': '#0A1422',
        'navy-light': '#0D1B2E',
        'navy-border': '#1B3054',
        'cyan-accent': '#00D4FF',
        'green-accent': '#00E676',
        'green-dark': '#00897B',
        'orange-accent': '#FF6B35',
        'yellow-accent': '#FFD600',
        'text-primary': '#E0E8F0',
        'text-secondary': '#7B8CA8',
        'text-muted': '#5A6E8A',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
