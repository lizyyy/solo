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
        academic: {
          50: '#f2f5fa',
          100: '#d9e1ec',
          200: '#b3c3da',
          300: '#7fa1c1',
          400: '#4f7aa3',
          500: '#2d5a87',
          600: '#1e3a5f',
          700: '#183050',
          800: '#142841',
          900: '#102036',
        },
        amber: {
          50: '#fdf8ed',
          100: '#faedc8',
          200: '#f3d98a',
          300: '#e9c04e',
          400: '#dfa82a',
          500: '#d4a853',
          600: '#b8863a',
          700: '#8d632c',
          800: '#6d4d27',
          900: '#573f24',
        },
        status: {
          normal: '#27ae60',
          abnormal: '#e74c3c',
          warning: '#f39c12',
          pending: '#95a5a6',
          unit: '#8e44ad',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'academic': '0 2px 12px rgba(30, 58, 95, 0.08)',
        'academic-lg': '0 8px 32px rgba(30, 58, 95, 0.12)',
        'gold-glow': '0 0 20px rgba(212, 168, 83, 0.25)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'highlight': 'highlight 2s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
      },
      keyframes: {
        highlight: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '20%, 60%': { backgroundColor: 'rgba(243, 156, 18, 0.25)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
