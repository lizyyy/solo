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
          50: "#E8F1F5",
          100: "#C9DCE6",
          200: "#8FB8CC",
          300: "#5A94B0",
          400: "#2F6E8F",
          500: "#0F3B5F",
          600: "#0B2E4A",
          700: "#082238",
          800: "#051726",
          900: "#030C14",
        },
        coral: {
          50: "#FFF1EC",
          100: "#FFD9CB",
          200: "#FFB39A",
          300: "#FF8C69",
          400: "#FF7A59",
          500: "#E85C3C",
          600: "#C44427",
        },
        status: {
          normal: "#3A9D85",
          supplement: "#4A90D9",
          anomaly: "#D9534F",
          cloud: "#8B7BBF",
        },
      },
      fontFamily: {
        serif: ['"Source Han Serif SC"', '"Noto Serif SC"', 'Georgia', 'serif'],
        sans: ['Inter', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-ring': 'pulseRing 1.6s ease-in-out 3',
        'fade-up': 'fadeUp 0.5s ease-out both',
        'slide-in-right': 'slideInRight 0.3s ease-out both',
      },
      keyframes: {
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(255,122,89,0.6)' },
          '100%': { boxShadow: '0 0 0 16px rgba(255,122,89,0)' },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
