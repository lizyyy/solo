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
        space: {
          900: "#0d0d1a",
          800: "#1a1a2e",
          700: "#25253d",
          600: "#32324d",
        },
        flame: {
          500: "#ff6b35",
          400: "#ff8c5a",
          600: "#e55a25",
        },
        alert: {
          500: "#e63946",
          400: "#ff6b6b",
        },
        ok: {
          500: "#2a9d8f",
          400: "#4dc4b6",
        },
      },
      fontFamily: {
        display: ['"Orbitron"', "monospace"],
        body: ['"Noto Sans SC"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(255,107,53,0.3)" },
          "50%": { boxShadow: "0 0 24px rgba(255,107,53,0.6)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
