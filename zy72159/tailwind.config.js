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
        primary: {
          DEFAULT: '#1a1a2e',
          50: '#f5f5f7',
          100: '#e5e5ec',
          200: '#c9c9d9',
          300: '#a2a2be',
          400: '#75759e',
          500: '#555580',
          600: '#434366',
          700: '#363652',
          800: '#2a2a40',
          900: '#1a1a2e',
        },
        accent: {
          DEFAULT: '#e8a838',
          50: '#fef8ed',
          100: '#fcecd4',
          200: '#f8d5a9',
          300: '#f3b972',
          400: '#ed953a',
          500: '#e8a838',
          600: '#d97d12',
          700: '#b45f10',
          800: '#914b14',
          900: '#763f14',
        },
        status: {
          processed: '#38a169',
          verify: '#dd6b20',
          onsite: '#e53e3e',
          pending: '#718096',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'sans-serif'],
        serif: ['"Noto Serif SC"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
