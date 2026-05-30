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
          900: '#0f0f1e',
          800: '#1a1a2e',
          700: '#242442',
          600: '#2e2e52',
          500: '#3a3a62',
        },
        amber: {
          DEFAULT: '#e8a838',
          light: '#f0c060',
          dark: '#c08020',
          muted: 'rgba(232,168,56,0.15)',
        },
        danger: {
          DEFAULT: '#c0392b',
          muted: 'rgba(192,57,43,0.15)',
        },
        success: {
          DEFAULT: '#27ae60',
          muted: 'rgba(39,174,96,0.15)',
        },
        warning: {
          DEFAULT: '#e67e22',
          muted: 'rgba(230,126,34,0.15)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
