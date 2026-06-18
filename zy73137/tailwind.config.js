/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ocean: {
          950: "#04172E",
          900: "#082A52",
          800: "#0B3D91",
          700: "#144EAA",
          600: "#1E60C7",
          500: "#2E7BDB",
        },
        tide: {
          500: "#2EC4B6",
          400: "#53D5C9",
          300: "#88E3DA",
        },
        alert: {
          red: "#E63946",
          amber: "#F4A261",
          ok: "#2EC4B6",
        },
        ink: {
          50: "#F5F7FB",
          100: "#E7ECF5",
          200: "#C7D0E0",
          300: "#96A4BE",
          500: "#4B5A73",
          700: "#232E42",
          900: "#0B1324",
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(14, 82, 180, 0.35)",
        card: "0 10px 30px -12px rgba(4, 23, 46, 0.25)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2.6)", opacity: "0" },
        },
        floatSlow: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.8s ease-out infinite",
        floatSlow: "floatSlow 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
