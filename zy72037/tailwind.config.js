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
          bg: "#1a1a2e",
          gold: "#e6a817",
          card: "#4a3f6b",
          correct: "#2ecc71",
          error: "#e74c3c",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-gold": "pulseGold 2s ease-in-out infinite",
        "bounce-in": "bounceIn 0.5s ease-out",
        ripple: "ripple 0.6s ease-out forwards",
        "slide-in": "slideIn 0.4s ease-out",
        "score-pulse": "scorePulse 0.4s ease-out",
        "combo-glow": "comboGlow 1.5s ease-in-out infinite",
        "dot-pulse": "dotPulse 1.5s ease-in-out infinite",
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
        pulseGold: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(230, 168, 23, 0.4)" },
          "50%": { boxShadow: "0 0 0 12px rgba(230, 168, 23, 0)" },
        },
        bounceIn: {
          "0%": { opacity: "0", transform: "scale(0.3)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)" },
        },
        ripple: {
          "0%": { transform: "scale(0)", opacity: "0.5" },
          "100%": { transform: "scale(4)", opacity: "0" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translate(-50%, -20px)" },
          "100%": { opacity: "1", transform: "translate(-50%, 0)" },
        },
        scorePulse: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        comboGlow: {
          "0%, 100%": { boxShadow: "0 0 6px rgba(46, 204, 113, 0.3)" },
          "50%": { boxShadow: "0 0 14px rgba(46, 204, 113, 0.6)" },
        },
        dotPulse: {
          "0%, 100%": { transform: "translateX(-50%) scale(1)" },
          "50%": { transform: "translateX(-50%) scale(1.6)" },
        },
      },
    },
  },
  plugins: [],
};
