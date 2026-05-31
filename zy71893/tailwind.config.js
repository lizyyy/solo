/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        sans: ['Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        iron: {
          DEFAULT: '#1E293B',
          light: '#334155',
          lighter: '#475569',
        },
        signal: {
          DEFAULT: '#F97316',
          dim: '#EA580C',
        },
        mint: {
          DEFAULT: '#10B981',
          dim: '#059669',
        },
        slate: {
          bg: '#0F172A',
          card: '#1E293B',
          hover: '#273548',
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
        'slide-in-bottom': 'slideInBottom 0.2s ease-out forwards',
      },
    },
  },
  plugins: [],
};
