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
        night: {
          bg: "#0D0D1A",
          panel: "#1A1A2E",
          card: "#252540",
          border: "#3A3A5C",
        },
        neon: {
          orange: "#FF6B35",
          yellow: "#FFD23F",
          red: "#E63946",
          cyan: "#2EC4B6",
          purple: "#9B5DE5",
        },
      },
      fontFamily: {
        game: ['"ZCOOL KuaiLe"', '"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "smoke-drift": "smoke-drift 4s ease-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(255,107,53,0.4)" },
          "50%": { boxShadow: "0 0 20px rgba(255,107,53,0.8)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "smoke-drift": {
          "0%": { opacity: "0.8", transform: "translateX(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateX(20px) scale(1.5)" },
        },
      },
    },
  },
  plugins: [],
};
