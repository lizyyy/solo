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
        paper: "#F5F0E8",
        ink: "#2C2C2C",
        ochre: {
          DEFAULT: "#A0522D",
          light: "#C4764A",
          dark: "#7A3E21",
          tint: "#FDF5EE",
        },
        conflict: "#C0392B",
        pending: "#D4A017",
        resolved: "#2E7D32",
        source: "#5B7FA5",
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "Menlo", "monospace"],
      },
      borderRadius: {
        sm: "4px",
      },
      minWidth: {
        "1280": "1280px",
      },
    },
  },
  plugins: [],
};
