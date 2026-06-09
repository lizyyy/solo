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
          DEFAULT: '#1e40af',
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#1e40af',
          700: '#1e3a8a',
        },
        success: '#16a34a',
        warning: '#ea580c',
        danger: '#dc2626',
        muted: '#6b7280',
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 14px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06)',
      },
      animation: {
        expand: 'expand 0.25s ease-out',
      },
      keyframes: {
        expand: {
          from: { opacity: '0', maxHeight: '0' },
          to: { opacity: '1', maxHeight: '1000px' },
        },
      },
    },
  },
  plugins: [],
};
