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
          50: "#f0f5fa",
          100: "#d9e4ef",
          200: "#b3c8df",
          300: "#84a6cb",
          400: "#4d7eb2",
          500: "#1e3a5f",
          600: "#193050",
          700: "#142640",
          800: "#0f1d30",
          900: "#0a1420",
        },
        status: {
          confirmed: {
            light: "#e8f5e9",
            DEFAULT: "#2e7d32",
            dark: "#1b5e20",
          },
          pending: {
            light: "#fff8e1",
            DEFAULT: "#f57f17",
            dark: "#e65100",
          },
          manual: {
            light: "#fbe9e7",
            DEFAULT: "#d84315",
            dark: "#bf360c",
          },
          conflict: {
            light: "#fff3e0",
            DEFAULT: "#e65100",
          },
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', "serif"],
        body: ['"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "2px",
        md: "4px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};
