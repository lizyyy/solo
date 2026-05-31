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
          DEFAULT: '#1a3a3a',
          50: '#e8efef',
          100: '#c6d6d6',
          200: '#9eb9b9',
          300: '#769c9c',
          400: '#588686',
          500: '#3a7070',
          600: '#2d5858',
          700: '#1a3a3a',
          800: '#132c2c',
          900: '#0c1e1e',
        },
        accent: {
          DEFAULT: '#d4a855',
          50: '#fbf5e7',
          100: '#f5e7c3',
          200: '#eed79b',
          300: '#e8c773',
          400: '#debb56',
          500: '#d4a855',
          600: '#c4934e',
          700: '#ae7a46',
          800: '#98623e',
          900: '#734131',
        },
        cream: {
          DEFAULT: '#f5f1e8',
          50: '#fdfcf9',
          100: '#faf7f0',
          200: '#f5f1e8',
          300: '#e8e0cf',
          400: '#d4c8b0',
        },
        deviation: {
          severe: '#c0392b',
          mild: '#e67e22',
          normal: '#27ae60',
          unreviewed: '#7f8c8d',
        },
        paper: '#faf8f3',
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'paper-texture': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
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
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      scale: {
        '98': '0.98',
      },
      boxShadow: {
        'paper': '0 1px 3px rgba(26, 58, 58, 0.08), 0 4px 12px rgba(26, 58, 58, 0.05)',
        'card': '0 2px 8px rgba(26, 58, 58, 0.1), 0 8px 24px rgba(26, 58, 58, 0.08)',
        'hover': '0 4px 16px rgba(212, 168, 85, 0.15), 0 12px 32px rgba(26, 58, 58, 0.12)',
      },
    },
  },
  plugins: [],
};
