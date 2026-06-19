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
        ink: {
          50: "#f5f7fa",
          100: "#e8edf3",
          200: "#c9d4e2",
          300: "#9aadc4",
          400: "#6680a0",
          500: "#455f82",
          600: "#354a6a",
          700: "#2a3b55",
          800: "#1e3a5f",
          900: "#152a47",
          950: "#0d1a2e",
        },
        ember: {
          50: "#fdf5ee",
          100: "#fae7d4",
          200: "#f3cba1",
          300: "#eba667",
          400: "#e48439",
          500: "#e07b39",
          600: "#cc5e1f",
          700: "#a94819",
          800: "#873a1a",
          900: "#6e3118",
        },
        slate2: {
          50: "#faf8f4",
          100: "#f2efe6",
          200: "#e5dfcc",
          300: "#d4cab0",
          400: "#bdae89",
          500: "#a99469",
          600: "#8a7855",
          700: "#6f6145",
          800: "#5a6b7c",
          900: "#4b5066",
        },
        paper: "#faf8f4",
        verdict: {
          pass: "#2f7d4f",
          warn: "#c07a15",
          fail: "#b23c2e",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: "0 1px 2px rgba(30,58,95,0.06), 0 2px 8px rgba(30,58,95,0.06)",
        pop: "0 8px 24px rgba(13,26,46,0.12)",
      },
      borderRadius: {
        sm2: "3px",
      },
    },
  },
  plugins: [],
};
