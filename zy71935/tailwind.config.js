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
          50: "#f0f5ff",
          100: "#e0ebff",
          200: "#b9d3ff",
          300: "#7bacff",
          400: "#3b82f6",
          500: "#1e3a5f",
          600: "#183055",
          700: "#142545",
          800: "#101d38",
          900: "#0c162d",
        },
        material: {
          light: "#dbeafe",
          DEFAULT: "#3b82f6",
          dark: "#1d4ed8",
        },
        conclusion: {
          light: "#ffedd5",
          DEFAULT: "#f97316",
          dark: "#c2410c",
        },
      },
      fontFamily: {
        sans: ["PingFang SC", "SF Pro Display", "system-ui", "sans-serif"],
      },
      animation: {
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.4s ease-out",
        "pulse-soft": "pulseSoft 2s infinite",
        "bounce-subtle": "bounceSubtle 0.5s ease-out",
      },
      keyframes: {
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        bounceSubtle: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
