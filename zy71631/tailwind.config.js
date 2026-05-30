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
        'theater-dark': '#0D1117',
        'theater-panel': '#161B22',
        'theater-border': '#30363D',
        'theater-accent': '#58A6FF',
        'theater-orange': '#FF8C00',
        'theater-gold': '#e6b422',
        'theater-red': '#f85149',
        'theater-green': '#7ee787',
        'theater-purple': '#d2a8ff',
      },
      fontFamily: {
        'display': ['Space Grotesk', 'system-ui', 'sans-serif'],
        'sans': ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'theater': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'glow': '0 0 20px rgba(88, 166, 255, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
};
