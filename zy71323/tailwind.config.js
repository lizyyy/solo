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
          50: "#e6f4ff",
          100: "#b3deff",
          200: "#80c8ff",
          300: "#4db2ff",
          400: "#1a9cff",
          500: "#0a85e5",
          600: "#0a2540",
          700: "#071a30",
          800: "#051220",
          900: "#020910",
        },
        tech: {
          400: "#4de2ff",
          500: "#00d4ff",
          600: "#00a8cc",
        },
        alert: {
          500: "#ff6b35",
          600: "#e55a2b",
        },
        success: {
          500: "#00c896",
          600: "#00a078",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        body: ['Inter', "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "slide-up": "slideUp 0.5s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 212, 255, 0.5)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 212, 255, 0.8)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
