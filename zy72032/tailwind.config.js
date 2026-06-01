/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "960px",
        xl: "960px",
      },
    },
    extend: {
      colors: {
        brand: {
          50: "#fff3ed",
          100: "#ffe4d4",
          200: "#ffc5a8",
          300: "#ff9e72",
          400: "#ff6b35",
          500: "#f44d16",
          600: "#d5350e",
          700: "#b0250f",
          800: "#8e1f14",
          900: "#741c15",
        },
        slate: {
          950: "#0f172a",
        },
        success: "#4ade80",
        danger: "#f87171",
        warning: "#fbbf24",
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
