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
        heading: ['"Noto Serif SC"', 'serif'],
        body: ['"Noto Sans SC"', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#1e293b',
          light: '#334155',
        },
        accent: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
        },
        success: '#10b981',
        danger: '#f43f5e',
        surface: '#ffffff',
        bgPage: '#f8fafc',
      },
    },
  },
  plugins: [],
};
