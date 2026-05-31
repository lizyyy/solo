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
          bg: "#F5F3EF",
          text: "#2D2D2D",
          accent: "#4A6FA5",
          confirmed: "#7BA37E",
          pending: "#D4A843",
          corrected: "#C75C5C",
          sidebar: "#2D2D2D",
          card: "#FFFFFF",
          border: "#E5E2DC",
          muted: "#8A8780",
        },
      },
    },
  },
  plugins: [],
};
