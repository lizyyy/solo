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
          50: "#F5F7FA",
          100: "#E4E9EF",
          200: "#C7D0DB",
          300: "#93A1B5",
          400: "#5A6A82",
          500: "#39475B",
          600: "#2A3649",
          700: "#1F2A37",
          800: "#172030",
          900: "#0F1623",
        },
        warn: {
          50: "#FFF7E6",
          100: "#FCE4B4",
          200: "#F4CC7A",
          300: "#EEB34E",
          400: "#E8A33D",
          500: "#D68E2C",
          600: "#B9731F",
          700: "#8E5717",
        },
        rust: {
          50: "#FCEDE8",
          100: "#F5C9BC",
          200: "#E89280",
          300: "#DC6956",
          400: "#C84B31",
          500: "#A83820",
          600: "#832A16",
        },
        mint: {
          50: "#E6F3F5",
          100: "#B6DBE0",
          200: "#82BFC8",
          300: "#5FA8B9",
          400: "#418B9D",
          500: "#2E6E80",
        },
      },
      fontFamily: {
        sans: ['"Source Han Sans CN"', '"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', "monospace"],
        display: ['"Source Han Sans Heavy"', '"Source Han Sans CN"', "sans-serif"],
      },
      boxShadow: {
        inset_ink: "inset 0 2px 6px 0 rgba(15, 22, 35, 0.25)",
        warn_glow: "0 0 0 1px rgba(232, 163, 61, 0.6)",
      },
      keyframes: {
        pulseBorder: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(200, 75, 49, 0.55)" },
          "50%": { boxShadow: "0 0 0 6px rgba(200, 75, 49, 0)" },
        },
        fadeInStagger: {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
        animation: {
          pulseBorder: "pulseBorder 2.4s ease-in-out infinite",
          fadeInStagger: "fadeInStagger 0.35s ease-out both",
        },
    },
  },
  plugins: [],
};
