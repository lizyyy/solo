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
          50: "#f0f7f9",
          100: "#d9edf1",
          200: "#b3dbe4",
          300: "#82c2d1",
          400: "#4aa0b6",
          500: "#2f859c",
          600: "#0F4C5C",
          700: "#0c3d4a",
          800: "#0a333e",
          900: "#07242c",
          950: "#05181d",
        },
        risk: {
          critical: "#E63946",
          warning: "#F4A261",
          safe: "#2A9D8F",
          unknown: "#6B7280",
          waiver: "#264653",
        },
      },
      fontFamily: {
        serif: ["'Noto Serif SC'", "serif"],
        sans: ["'Noto Sans SC'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
