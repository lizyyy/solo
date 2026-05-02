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
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        status: {
          pending: '#f59e0b',
          in_progress: '#3b82f6',
          pending_review: '#8b5cf6',
          completed: '#10b981',
          closed: '#6b7280',
          overdue: '#ef4444',
          abnormal: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}
