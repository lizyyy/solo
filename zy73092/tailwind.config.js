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
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#1e40af",
          700: "#1e3a8a",
          800: "#172554",
          900: "#0f172a",
        },
        industry: {
          blue: "#1e40af",
          dark: "#0f172a",
          steel: "#334155",
        },
      },
      fontFamily: {
        sans: [
          '"PingFang SC"',
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          '"SF Mono"',
          '"JetBrains Mono"',
          '"Fira Code"',
          '"Cascadia Code"',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          "monospace",
        ],
      },
      backgroundImage: {
        "diagonal-stripes":
          "repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.4) 0, rgba(148, 163, 184, 0.4) 2px, transparent 2px, transparent 8px)",
        "diagonal-stripes-sm":
          "repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.35) 0, rgba(148, 163, 184, 0.35) 1.5px, transparent 1.5px, transparent 6px)",
      },
    },
  },
  plugins: [],
};
