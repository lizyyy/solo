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
        navy: {
          50: "#eef3f9",
          100: "#d6e3f0",
          200: "#adc6e1",
          300: "#7ba4cd",
          400: "#4d80b6",
          500: "#2f649c",
          600: "#244e7e",
          700: "#1e3a5f",
          800: "#1a314f",
          900: "#15273e",
          950: "#0e1a2a",
        },
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        emerald: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', 'Menlo', 'Consolas', 'monospace'],
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'sink': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.08)',
        'lift': '0 -2px 8px 0 rgba(0, 0, 0, 0.04), 0 4px 16px 0 rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
};
