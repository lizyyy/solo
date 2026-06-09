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
        ink: {
          900: "#0A1F27",
          800: "#0F3B4B",
          700: "#165168",
          600: "#1E6A88",
        },
        alert: {
          red: "#D72638",
          orange: "#FF6B35",
          green: "#27A36E",
          amber: "#F59E0B",
        },
      },
      fontFamily: {
        serif: ["Charter", "Georgia", "Times New Roman", "serif"],
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "monospace"],
      },
      animation: {
        "breath-red": "breathRed 2s ease-in-out infinite",
        "pulse-ring": "pulseRing 1.2s ease-out",
        "stagger-in": "staggerIn 400ms ease-out both",
      },
      keyframes: {
        breathRed: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(215,38,56,0.45)" },
          "50%": { boxShadow: "0 0 0 8px rgba(215,38,56,0)" },
        },
        pulseRing: {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        staggerIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
