/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        museum: {
          dark: '#1a3a2a',
          mid: '#2d5a42',
          light: '#3d7a58',
          copper: '#c48a5a',
          copperLight: '#d4a67a',
          cream: '#f5f0e8',
          creamDark: '#e8e0d4',
          border: '#d4cfc5',
        }
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
