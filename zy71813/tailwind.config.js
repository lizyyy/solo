/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        status: {
          pending: '#f59e0b',
          investigating: '#3b82f6',
          resolved: '#10b981',
          disputed: '#ef4444',
          material_only: '#8b5cf6',
          conclusion_changed: '#dc2626',
        }
      }
    },
  },
  plugins: [],
}
