/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'carbon-low': '#10b981',
        'carbon-mid': '#f59e0b',
        'carbon-high': '#ef4444',
        'confirmed': '#3b82f6',
        'tentative': '#a855f7',
      }
    },
  },
  plugins: [],
}
