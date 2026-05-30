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
        primary: "#F6A623",
        secondary: "#1A2744",
        warning: "#FF6B6B",
        success: "#4ECDC4",
        gold: "#F6A623",
        indigo: "#1A2744",
        coral: "#FF6B6B",
        mint: "#4ECDC4",
      },
      fontFamily: {
        display: ["'ZCOOL XiaoWei'", "serif"],
        body: ["'Noto Sans SC'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
