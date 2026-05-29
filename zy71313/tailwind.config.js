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
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0D7377',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        primary: '#0D7377',
        accent: '#FF6B35',
      },
      fontFamily: {
        kai: ['"LXGW WenKai"', '"Noto Sans SC"', 'serif'],
        sans: ['"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Noto Sans SC"', 'monospace'],
      },
    },
  },
  plugins: [],
};
