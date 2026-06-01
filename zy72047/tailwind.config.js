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
        vinyl: {
          50: "#faf6f3",
          100: "#f0e6dd",
          200: "#e0ccba",
          300: "#c9a88d",
          400: "#b38665",
          500: "#9c6a4a",
          600: "#8a563d",
          700: "#6b4132",
          800: "#4a2c22",
          900: "#2C1810",
          950: "#1a0e09",
        },
        gold: {
          50: "#fdf9e7",
          100: "#faefc2",
          200: "#f6df86",
          300: "#efc84a",
          400: "#E8B73A",
          500: "#D4AF37",
          600: "#b88d28",
          700: "#946823",
          800: "#7a5323",
          900: "#684522",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "serif"],
        sans: ['"Noto Sans SC"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 8s linear infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "bounce-soft": "bounceSoft 0.6s ease-out",
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
        bounceSoft: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
      },
      boxShadow: {
        "vinyl": "0 4px 20px rgba(44, 24, 16, 0.3)",
        "gold": "0 2px 12px rgba(212, 175, 55, 0.4)",
      },
    },
  },
  plugins: [],
};
