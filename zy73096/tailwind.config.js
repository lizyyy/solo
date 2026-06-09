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
        blueprint: {
          50: "#f1f5ff",
          100: "#dbe4ff",
          200: "#bac8ff",
          300: "#91a7ff",
          400: "#5c7cfa",
          500: "#0a2463",
          600: "#081d4f",
          700: "#061539",
          800: "#040e26",
          900: "#020918",
        },
        paper: {
          50: "#fbfaf7",
          100: "#f5f0e8",
          200: "#e6ddcc",
          300: "#d2c4a7",
          400: "#b9a582",
        },
        fire: {
          critical: "#d62828",
          warning: "#f77f00",
          info: "#457b9d",
          pass: "#40916c",
          doubt: "#d4a017",
          fail: "#9b2226",
        },
        steel: {
          400: "#868e96",
          500: "#495057",
          600: "#343a40",
          700: "#212529",
        },
      },
      fontFamily: {
        eng: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ['"IBM Plex Sans SC"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "blueprint-grid":
          "linear-gradient(rgba(92,124,250,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(92,124,250,0.08) 1px, transparent 1px)",
        "paper-grain":
          "radial-gradient(circle at 20% 30%, rgba(185,165,130,0.12), transparent 50%), radial-gradient(circle at 80% 70%, rgba(185,165,130,0.08), transparent 50%)",
      },
      backgroundSize: {
        "blueprint-grid": "24px 24px",
      },
      boxShadow: {
        "eng-inset":
          "inset 1px 1px 0 rgba(255,255,255,0.05), inset -1px -1px 0 rgba(0,0,0,0.35)",
        "stamp": "0 0 0 2px #9b2226, 0 0 0 3px #f5f0e8, 0 0 0 5px #9b2226",
      },
      animation: {
        "pulse-slow": "pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-in-right":
          "slideInRight 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "stamp-in": "stampIn 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
      keyframes: {
        slideInRight: {
          "0%": { transform: "translateX(16px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        stampIn: {
          "0%": { transform: "rotate(-12deg) scale(1.6)", opacity: "0" },
          "60%": { transform: "rotate(-4deg) scale(0.95)", opacity: "0.8" },
          "100%": { transform: "rotate(-6deg) scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
