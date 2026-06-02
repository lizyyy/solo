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
        display: ['"Playfair Display"', 'serif'],
        body: ['"Noto Sans SC"', 'sans-serif'],
      },
      colors: {
        festival: {
          indigo: '#1e293b',
          amber: '#f59e0b',
          emerald: '#10b981',
          rose: '#f43f5e',
          slate: '#64748b',
        },
      },
    },
  },
  plugins: [],
};
