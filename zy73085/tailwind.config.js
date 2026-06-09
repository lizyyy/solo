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
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#1E40AF",
          700: "#1E3A8A",
          800: "#1E3169",
          900: "#172554",
        },
        warn: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          300: "#FDBA74",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
          800: "#9A3412",
          900: "#7C2D12",
        },
        safe: {
          50: "#F0FDF4",
          100: "#DCFCE7",
          200: "#BBF7D0",
          300: "#86EFAC",
          400: "#4ADE80",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D",
          800: "#166534",
          900: "#14532D",
        },
        danger: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          300: "#FCA5A5",
          400: "#F87171",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
          800: "#991B1B",
          900: "#7F1D1D",
        },
        ink: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#71717A",
          600: "#52525B",
          700: "#3F3F46",
          800: "#27272A",
          900: "#18181B",
        },
      },
      borderRadius: {
        eng: "4px",
      },
      fontFamily: {
        display: ['"Noto Sans SC"', '"Source Han Sans CN"', "system-ui", "sans-serif"],
        body: ['"Noto Sans SC"', '"Source Han Sans CN"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', "Menlo", "monospace"],
      },
      boxShadow: {
        eng: "0 1px 2px 0 rgba(24, 24, 27, 0.05), 0 1px 3px 0 rgba(24, 24, 27, 0.1)",
        "eng-pressed": "inset 0 2px 4px 0 rgba(24, 24, 27, 0.15)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      backgroundImage: {
        "grid-eng":
          "linear-gradient(to right, rgba(39, 39, 42, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(39, 39, 42, 0.06) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
