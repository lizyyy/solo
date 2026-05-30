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
        jazz: {
          bg: "#1A1A2E",
          bgLight: "#252542",
          bgDark: "#12121F",
          gold: "#D4AF37",
          goldLight: "#E8C85A",
          goldDark: "#B8962E",
          burgundy: "#722F37",
          burgundyLight: "#8B3D45",
          burgundyDark: "#5A252C",
          green: "#2D5A27",
          greenLight: "#3D7A35",
          orange: "#E67E22",
          orangeLight: "#F39C12",
          purple: "#8E44AD",
          purpleLight: "#9B59B6",
          text: "#E8E6E3",
          textMuted: "#A0A0B0",
          border: "#3A3A5A",
        },
      },
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        mono: ["'Source Code Pro'", "monospace"],
      },
      animation: {
        "pulse-gold": "pulse-gold 1.5s ease-in-out infinite",
        "beat": "beat 0.5s ease-in-out",
        "slide-up": "slide-up 0.3s ease-out",
        "shake": "shake 0.4s ease-in-out",
      },
      keyframes: {
        "pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(212, 175, 55, 0.4)" },
          "50%": { boxShadow: "0 0 0 10px rgba(212, 175, 55, 0)" },
        },
        "beat": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
      },
    },
  },
  plugins: [],
};
