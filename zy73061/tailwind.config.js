/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        lg: "2rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
    },
    extend: {
      colors: {
        industrial: {
          50: "#F0F4FA",
          100: "#D9E2EF",
          200: "#B3C5DF",
          300: "#7D9AC7",
          400: "#4A6FA7",
          500: "#1E3A5F",
          600: "#1A3354",
          700: "#142943",
          800: "#0F2036",
          900: "#0A1726",
        },
        alert: {
          red: "#FF3B30",
          orange: "#FF7A45",
          yellow: "#FFCC00",
          green: "#34C759",
          blue: "#007AFF",
        },
        surface: {
          base: "#F7F9FC",
          card: "#FFFFFF",
          muted: "#F0F3F7",
          border: "#E2E8F0",
        },
      },
      fontFamily: {
        sans: [
          '"Noto Sans SC"',
          '"Source Han Sans SC"',
          '"PingFang SC"',
          "sans-serif",
        ],
        serif: [
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"Songti SC"',
          "serif",
        ],
        mono: [
          '"JetBrains Mono"',
          '"SF Mono"',
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(30,58,95,0.08), 0 1px 2px rgba(30,58,95,0.06)",
        hover: "0 10px 25px rgba(30,58,95,0.12), 0 4px 10px rgba(30,58,95,0.08)",
        inset: "inset 0 1px 2px rgba(30,58,95,0.08)",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        lg: "10px",
        xl: "14px",
      },
      keyframes: {
        "slide-down": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "shake-light": {
          "0%,100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-2px)" },
          "75%": { transform: "translateX(2px)" },
        },
        "count-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "slide-down": "slide-down 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "shake-light": "shake-light 0.5s ease-in-out",
        "count-up": "count-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};
