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
          DEFAULT: "#0F4C5C",
          50: "#EAF4F6",
          100: "#CDE5EA",
          200: "#9BCBD4",
          300: "#69B1BE",
          400: "#3797A8",
          500: "#0F4C5C",
          600: "#0C3E4B",
          700: "#09313A",
          800: "#062329",
          900: "#031619",
        },
        ember: {
          DEFAULT: "#E36414",
          50: "#FDEEDC",
          100: "#FAD9B9",
          200: "#F5B372",
          300: "#F08D2C",
          400: "#E36414",
          500: "#B84E0E",
          600: "#8A3A0B",
          700: "#5C2707",
        },
        moss: {
          DEFAULT: "#5F7367",
          50: "#EEF2F0",
          100: "#DDE5E0",
          200: "#BCCBC2",
          300: "#9AB1A3",
          400: "#799785",
          500: "#5F7367",
          600: "#4A5A50",
          700: "#36413B",
          800: "#212925",
        },
        paper: {
          DEFAULT: "#FBF7F2",
          dark: "#F2EADB",
          line: "#E6D9C0",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,76,92,0.08), 0 1px 2px rgba(15,76,92,0.04)",
        cardHover: "0 6px 20px rgba(15,76,92,0.12), 0 2px 6px rgba(15,76,92,0.06)",
        inset: "inset 0 1px 2px rgba(15,76,92,0.06)",
      },
      animation: {
        stamp: "stamp 0.3s ease-out",
        slideIn: "slideIn 0.25s ease-out",
        fadeIn: "fadeIn 0.3s ease-out",
      },
      keyframes: {
        stamp: {
          "0%": { transform: "scale(1.3) rotate(-8deg)", opacity: "0" },
          "60%": { transform: "scale(0.95) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(-4deg)", opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
