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
        navy: {
          900: '#0D1B2A',
          800: '#1B2A4A',
          700: '#2A3F6A',
          600: '#3A5490',
        },
        industrial: {
          orange: '#E8712B',
          blue: '#00A3E0',
          red: '#DC3545',
          green: '#28A745',
          amber: '#FFC107',
        },
      },
      fontFamily: {
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
