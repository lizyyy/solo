/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#8B2252',
          light: '#B84479',
          dark: '#6A1A3E',
        },
        gold: {
          DEFAULT: '#D4A843',
          light: '#E8C76A',
          dark: '#B8912E',
        },
        surface: {
          DEFAULT: '#1A1A2E',
          card: '#16213E',
          hover: '#1C2A4A',
          border: '#2A3A5C',
        },
        status: {
          confirmed: '#2ECC71',
          temporary: '#F39C12',
          conflict: '#E74C3C',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Noto Sans SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
