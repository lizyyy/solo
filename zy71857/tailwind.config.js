/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        'lab-bg': '#1a1a1a',
        'lab-card': '#252525',
        'lab-border': '#333333',
        'lab-accent': '#39ff14',
        'lab-supplement': '#ffd700',
        'lab-conclusion': '#ff4444',
        'lab-anomaly': '#ff8800',
        'lab-text': '#e0e0e0',
        'lab-text-muted': '#888888',
      },
    },
  },
  plugins: [],
}
