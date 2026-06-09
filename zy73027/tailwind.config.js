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
        brand: {
          orange: "#E87722",
          green: "#2D6A4F",
          red: "#C1121F",
          cream: "#F5F5F0",
        },
      },
      fontFamily: {
        display: ['"ZCOOL XiaoWei"', '"LXGW WenKai"', "serif"],
        body: ['"LXGW WenKai"', '"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
      },
    },
  },
  plugins: [],
};
