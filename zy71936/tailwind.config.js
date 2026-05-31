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
        accent: "#e94560",
        surface: "#1e1e38",
        "surface-light": "#2a2a4a",
        base: "#1a1a2e",
        "text-primary": "#eaeaea",
        "text-secondary": "#9ca3af",
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      animation: {
        "slide-in": "slideIn 0.3s ease-out",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
