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
        carbon: {
          950: "#0a0c0b",
          900: "#0e1110",
          850: "#131816",
          800: "#181e1b",
          700: "#1f2722",
          600: "#2a3329",
          500: "#3a4538",
        },
        bone: "#e7e9e3",
        ash: "#8b9087",
        line: "rgba(231,233,227,0.08)",
        amber: {
          DEFAULT: "#ffb000",
          soft: "#ffc94d",
          deep: "#c98a00",
        },
        pass: "#00d97e",
        warn: "#e8c547",
        block: "#ff4d4f",
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        sans: ['"IBM Plex Sans"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};
