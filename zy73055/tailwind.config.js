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
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Noto Sans SC', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#F0F4FA',
          100: '#D9E2EF',
          200: '#B3C5DF',
          300: '#7D9CC6',
          400: '#4A74AA',
          500: '#2A558C',
          600: '#1E3A5F',
          700: '#182F4C',
          800: '#13253D',
          900: '#0F1D30',
        },
      },
      boxShadow: {
        'inner-lifted': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};
