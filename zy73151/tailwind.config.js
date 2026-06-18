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
        ocean: {
          50: "#F0F7FA",
          100: "#DCEBF2",
          200: "#B7D7E5",
          300: "#8ABCD0",
          400: "#5599B8",
          500: "#1A7A9A",
          600: "#136582",
          700: "#0F4F66",
          800: "#0B3D5C",
          900: "#072840",
          950: "#041A2B",
        },
        alert: {
          orange: "#FF7A45",
          red: "#E74C3C",
          yellow: "#F1C40F",
          green: "#2ECC71",
          blue: "#3498DB",
        },
      },
      fontFamily: {
        serif: ['"Source Serif Pro"', "Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'slide-in-right': 'slideInRight 0.4s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.4s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      boxShadow: {
        'card': '0 2px 8px rgba(11, 61, 92, 0.08)',
        'card-hover': '0 8px 24px rgba(11, 61, 92, 0.12)',
        'glow-orange': '0 0 20px rgba(255, 122, 69, 0.4)',
        'glow-blue': '0 0 20px rgba(26, 122, 154, 0.4)',
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
      },
    },
  },
  plugins: [],
};
