/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'stage-dark': '#0a0a0f',
        'stage-blue': '#0066ff',
        'stage-orange': '#ff9500',
        'stage-red': '#ff3b30',
        'stage-green': '#34c759',
        'stage-gray': '#1c1c1e',
        'stage-gray-light': '#2c2c2e'
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}
