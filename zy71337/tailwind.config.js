/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E8EEF6',
          100: '#C5D4E8',
          200: '#9EB7D9',
          300: '#779AC9',
          400: '#5A83BE',
          500: '#3D6CB3',
          600: '#3764AC',
          700: '#2F59A2',
          800: '#274F98',
          900: '#1B3E86',
          950: '#1E3A5F',
        },
        accent: {
          amber: '#F59E0B',
          emerald: '#10B981',
          rose: '#EC4899',
        },
        dark: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
