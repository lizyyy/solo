/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        base: {
          900: '#0d0d1a',
          800: '#1a1a2e',
          700: '#16213e',
          600: '#1f2b47',
          500: '#2a3a5c',
        },
        accent: {
          gold: '#f0a500',
          'gold-dim': '#c48800',
          red: '#e74c3c',
          'red-dim': '#c0392b',
          green: '#2ecc71',
          'green-dim': '#27ae60',
          amber: '#f39c12',
        },
        surface: {
          card: '#1e2a45',
          hover: '#243352',
          border: '#2d3f63',
          'border-gold': '#f0a50044',
        },
        text: {
          primary: '#e8e8ef',
          secondary: '#9ca3af',
          muted: '#6b7280',
          gold: '#f0a500',
          red: '#e74c3c',
          green: '#2ecc71',
        },
      },
      fontFamily: {
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Outfit"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
