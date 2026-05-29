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
        studio: {
          bg: '#0f1f1a',
          card: '#1a2f2a',
          surface: '#1e3a33',
          border: '#2d4a3f',
          muted: '#3d5c52',
          amber: '#e8a838',
          'amber-dark': '#d4952e',
          sand: '#f5f0e8',
        },
      },
      fontFamily: {
        display: ['DM Serif Display', 'Georgia', 'serif'],
        body: ['Source Sans 3', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
