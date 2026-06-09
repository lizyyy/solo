/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: '#1f2937',
        muted: '#6b7280',
        ok: '#059669',
        warn: '#d97706',
        bad: '#dc2626',
        line: '#e5e7eb'
      }
    }
  },
  plugins: []
}
