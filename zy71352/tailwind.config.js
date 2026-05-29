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
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#bcccdc",
          300: "#9fb3c8",
          400: "#829ab1",
          500: "#627d98",
          600: "#486581",
          700: "#334e68",
          800: "#243b53",
          900: "#102a43",
        },
        accent: {
          gold: {
            50: "#faf6f1",
            100: "#f0e6d8",
            200: "#e4d0b7",
            300: "#d4b58f",
            400: "#d4a574",
            500: "#c4956a",
            600: "#b08055",
            700: "#966947",
            800: "#7a553b",
            900: "#5a3e2c",
          },
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
        serif: ['"Noto Serif SC"', "Georgia", "serif"],
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-out both',
        'fadeInUp': 'fadeInUp 0.5s ease-out both',
        'slideIn': 'slideIn 0.3s ease-out both',
        'scaleIn': 'scaleIn 0.2s ease-out both',
        'shake': 'shake 0.4s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
      },
    },
  },
  plugins: [],
};
