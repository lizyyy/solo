/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f5fa',
          100: '#d9e4f1',
          200: '#b3c9e4',
          300: '#80a9d4',
          400: '#4d89c4',
          500: '#1e6fb5',
          600: '#1e3a5f',
          700: '#183050',
          800: '#142640',
          900: '#101e33'
        },
        warning: {
          500: '#e67e22'
        }
      },
      fontFamily: {
        sans: ['"Source Han Sans"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace']
      }
    },
  },
  plugins: [],
}
