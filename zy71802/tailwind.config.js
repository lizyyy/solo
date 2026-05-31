/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        warning: '#f59e0b',
        danger: '#dc2626',
        success: '#16a34a',
        pending: '#6366f1',
      }
    },
  },
  plugins: [],
}
