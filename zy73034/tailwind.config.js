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
        sage: {
          50: "#F3F5F0",
          100: "#E5EBE0",
          200: "#CBD8C1",
          300: "#A9BD9B",
          400: "#85A273",
          500: "#668452",
          600: "#4A6741",
          700: "#3B5233",
          800: "#304229",
          900: "#283722",
        },
        parchment: {
          50: "#FDFBF6",
          100: "#FAF6EE",
          200: "#F2EADA",
          300: "#E6D8BC",
        },
        clay: {
          50: "#FBEFE5",
          100: "#F6DCC2",
          200: "#EDBA85",
          300: "#E09852",
          400: "#C97B3B",
          500: "#A85E26",
          600: "#87481B",
        },
      },
      fontFamily: {
        song: ['"Source Han Serif CN"', '"Noto Serif SC"', 'SimSun', 'serif'],
        hei: ['"Source Han Sans CN"', '"Noto Sans SC"', '"PingFang SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: "0 2px 12px -4px rgba(58, 44, 20, 0.12), 0 1px 3px rgba(58, 44, 20, 0.06)",
        stamp: "inset 0 0 0 2px rgba(201, 123, 59, 0.6), 0 0 0 4px rgba(201, 123, 59, 0.15)",
      },
      backgroundImage: {
        paper:
          "radial-gradient(circle at 20% 10%, rgba(74,103,65,0.05) 0, transparent 40%), radial-gradient(circle at 80% 90%, rgba(201,123,59,0.06) 0, transparent 45%)",
      },
    },
  },
  plugins: [],
};
