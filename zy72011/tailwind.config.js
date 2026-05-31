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
          50: '#f0f5ff',
          100: '#d9e6ff',
          200: '#b3ccff',
          300: '#80a8ff',
          400: '#4d85ff',
          500: '#1e3a5f',
          600: '#1a3354',
          700: '#162d49',
          800: '#12263e',
          900: '#0e1f33',
        },
        success: '#2e7d32',
        warning: '#f57c00',
        danger: '#d32f2f',
      },
    },
  },
  plugins: [],
}
