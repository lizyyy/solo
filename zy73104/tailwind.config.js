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
          50:  "#eef3f9",
          100: "#d5e0ee",
          200: "#aac1dd",
          300: "#7fa2cb",
          400: "#5584ba",
          500: "#2f65a8",
          600: "#1e3a5f",
          700: "#172d4a",
          800: "#102035",
          900: "#091320",
        },
        accent: {
          confirmed: "#059669",
          pending:   "#2563eb",
          returned:  "#dc2626",
          suspended: "#d97706",
          withdraw:  "#991b1b",
          suppl:     "#ca8a04",
        },
        ink: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "ui-serif", "Georgia", "serif"],
        sans:  ['"Noto Sans SC"', "system-ui", "sans-serif"],
        mono:  ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15,23,42,0.04), 0 1px 3px 0 rgba(15,23,42,0.06)",
        inset: "inset 0 0 0 1px rgba(15,23,42,0.06)",
      },
      borderRadius: {
        sm2: "2px",
      },
    },
  },
  plugins: [],
};
