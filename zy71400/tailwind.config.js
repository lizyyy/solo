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
          bg: "#0f172a",
          card: "#1e293b",
          warning: "#f59e0b",
          success: "#10b981",
          danger: "#ef4444",
          info: "#3b82f6",
          "text-primary": "#f1f5f9",
          "text-secondary": "#94a3b8",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
