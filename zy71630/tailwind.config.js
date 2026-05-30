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
        risk: {
          1: '#22C55E',
          2: '#4ADE80',
          3: '#86EFAC',
          4: '#EAB308',
          5: '#FACC15',
          6: '#F97316',
          7: '#FB923C',
          8: '#EF4444',
          9: '#DC2626',
          10: '#991B1B',
        },
        anomaly: {
          maturity: '#F59E0B',
          guarantee: '#EF4444',
          rating: '#8B5CF6',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Roboto Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: 0.6 },
          '50%': { opacity: 1 },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
