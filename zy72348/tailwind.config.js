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
          DEFAULT: '#0d0d1a',
          100: '#12122a',
          200: '#1a1a2e',
          300: '#2a2a4a',
          400: '#3a3a5a',
        },
        accent: {
          orange: '#e94560',
          blue: '#0f3460',
          green: '#16c784',
          yellow: '#f5a623',
          purple: '#8b5cf6',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
