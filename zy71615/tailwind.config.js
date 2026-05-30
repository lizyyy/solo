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
        amber: {
          400: '#D4A037',
          500: '#E0B048',
          600: '#C09028',
        },
        slate: {
          950: '#0A1628',
          900: '#0F1D2F',
          800: '#1E2D3D',
          700: '#334155',
          600: '#475569',
        },
      },
    },
  },
  plugins: [],
};
