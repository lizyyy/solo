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
        primary: {
          50: '#e8f0f8',
          100: '#c5d7e8',
          200: '#9cb9d6',
          300: '#739bc4',
          400: '#5484b7',
          500: '#356da9',
          600: '#2f64a0',
          700: '#275794',
          800: '#1e3a5f',
          900: '#152a42',
        },
        anomaly: {
          red: '#e63946',
          yellow: '#ffb703',
          green: '#52b788',
          purple: '#9b5de5',
        },
        coord: {
          a: '#3b82f6',
          b: '#f97316',
        }
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
