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
        port: {
          bg: '#0f1923',
          surface: '#1a2332',
          card: '#1e2d3d',
          border: '#2a3a4a',
          hover: '#253545',
          orange: '#e8722a',
          'orange-light': '#f09050',
          text: '#e2e8f0',
          muted: '#8899aa',
        },
        status: {
          draft: '#3b82f6',
          confirm: '#eab308',
          done: '#22c55e',
          reject: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
