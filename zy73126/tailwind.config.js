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
        deep: {
          50: "#E8EEF7",
          100: "#C5D3E8",
          200: "#8FA8CE",
          300: "#4A6FA5",
          400: "#1D3A6B",
          500: "#0A2540",
          600: "#071A2E",
          700: "#05111F",
          800: "#03090F",
          900: "#010407",
        },
        coral: {
          50: "#FFF0EC",
          100: "#FFD8CC",
          200: "#FFB399",
          300: "#FF8A66",
          400: "#FF6B4A",
          500: "#E85532",
          600: "#B83E20",
        },
        reef: {
          400: "#5EEAD4",
          500: "#2EC4B6",
          600: "#14A394",
        },
        alert: {
          400: "#F76D79",
          500: "#E63946",
          600: "#B8222E",
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', '"LXGW WenKai"', '"Source Han Serif SC"', "serif"],
        mono: ['"JetBrains Mono"', '"SF Mono"', "ui-monospace", "monospace"],
      },
      keyframes: {
        "coral-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255, 107, 74, 0.55)" },
          "50%": { boxShadow: "0 0 0 8px rgba(255, 107, 74, 0)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "coral-pulse": "coral-pulse 2.4s ease-out infinite",
        "fade-up": "fade-up 500ms ease-out both",
        "slide-in-right": "slide-in-right 300ms ease-out both",
      },
    },
  },
  plugins: [],
};
