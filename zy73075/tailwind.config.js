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
        shield: {
          50: '#F0F7F8',
          100: '#D3E6E8',
          200: '#A7CDD1',
          300: '#6FA8AF',
          400: '#3E838C',
          500: '#0E4F55',
          600: '#0B3F44',
          700: '#082F33',
          800: '#062124',
          900: '#041618',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
        sans: ['"Noto Sans SC"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-shield': '0 0 24px rgba(14,79,85,0.35)',
        'glow-rose': '0 0 16px rgba(244,63,94,0.3)',
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shake': 'shake 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out both',
      },
      keyframes: {
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-4px)' },
          '40%,80%': { transform: 'translateX(4px)' },
        },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
