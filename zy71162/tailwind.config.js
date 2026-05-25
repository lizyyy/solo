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
          900: '#0E1625',
          800: '#141E33',
          700: '#1B2A41',
          600: '#223251',
          500: '#2E4268',
          400: '#4A6491',
        },
        accent: {
          DEFAULT: '#E2A93B',
          600: '#C48F26',
        },
        danger: {
          DEFAULT: '#E05252',
        },
        success: {
          DEFAULT: '#49B265',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"PingFang SC"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 12px rgba(226, 169, 59, 0.35)',
      },
    },
  },
  plugins: [],
};
