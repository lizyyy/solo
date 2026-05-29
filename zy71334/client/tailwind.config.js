/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'stage-dark': '#0f172a',
        'stage-darker': '#020617',
        'stage-blue': '#1e293b',
        'stage-border': '#334155',
        'accent-amber': '#f59e0b',
        'accent-orange': '#f97316',
        'accent-green': '#10b981',
        'accent-red': '#ef4444',
        'accent-yellow': '#eab308',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'glow-amber': '0 0 12px rgba(245, 158, 11, 0.5)',
        'glow-green': '0 0 12px rgba(16, 185, 129, 0.5)',
        'glow-red': '0 0 12px rgba(239, 68, 68, 0.5)',
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}
