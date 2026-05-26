/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1a365d',
        secondary: '#d4af37',
        success: '#48bb78',
        warning: '#ecc94b',
        danger: '#f56565',
        'room-empty': '#48bb78',
        'room-dirty': '#ecc94b',
        'room-occupied': '#4299e1',
        'room-maintenance': '#f56565',
        'room-extend': '#9f7aea',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
