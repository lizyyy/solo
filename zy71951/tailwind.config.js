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
        primary: "#1B2A3D",
        accent: "#E8913A",
        steel: "#4A7FB5",
        surface: "#F0F2F5",
        danger: "#DC2626",
        success: "#16A34A",
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'Monaco', 'monospace'],
      },
      spacing: {
        sidebar: "240px",
        header: "56px",
      },
    },
  },
  plugins: [],
};
