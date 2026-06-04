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
          50: "#E6F0FF",
          100: "#B3D1FF",
          200: "#80B3FF",
          300: "#4D94FF",
          400: "#1A75FF",
          500: "#165DFF",
          600: "#0E4BD4",
          700: "#0A3AA3",
          800: "#062872",
          900: "#031741",
        },
        warning: {
          50: "#FFF4E6",
          100: "#FFDEB3",
          200: "#FFC880",
          300: "#FFB24D",
          400: "#FF9C1A",
          500: "#FF7D00",
          600: "#CC6400",
          700: "#994B00",
          800: "#663200",
          900: "#331900",
        },
        success: {
          50: "#E6FFF0",
          100: "#B3FFD1",
          200: "#80FFB3",
          300: "#4DFF94",
          400: "#1AFF75",
          500: "#00B42A",
          600: "#009122",
          700: "#006E1A",
          800: "#004B11",
          900: "#002809",
        },
        industrial: {
          50: "#F7F8FA",
          100: "#E5E6EB",
          200: "#C9CDD4",
          300: "#86909C",
          400: "#4E5969",
          500: "#272E3B",
          600: "#1D2129",
          700: "#171A21",
          800: "#0F1218",
          900: "#0A0C10",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["PingFang SC", "Microsoft YaHei", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(22, 93, 255, 0.5)" },
          "100%": { boxShadow: "0 0 20px rgba(22, 93, 255, 0.8)" },
        },
      },
    },
  },
  plugins: [],
};
