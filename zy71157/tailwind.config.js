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
        airport: {
          bg: '#030712',
          surface: '#111827',
          border: '#1f2937',
          primary: '#3b82f6',
          secondary: '#06b6d4',
          success: '#22c55e',
          warning: '#eab308',
          danger: '#ef4444',
          info: '#3b82f6',
          text: '#f9fafb',
          textMuted: '#9ca3af',
        }
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'warning-flash': 'warning-flash 1s ease-in-out infinite',
        'score-popup': 'score-popup 1.2s ease-out forwards',
        'baggage-bounce': 'baggage-bounce 0.5s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};
