/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Source Han Sans SC"', "system-ui", "sans-serif"],
        serif: ['"Noto Serif SC"', '"Songti SC"', '"Source Han Serif SC"', "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        brand: {
          50: "#eff6ff",
          500: "#1E40AF",
          700: "#1d4ed8",
          900: "#1e3a8a",
        },
        warn: {
          500: "#EA580C",
        },
      },
    },
  },
  plugins: [],
};
