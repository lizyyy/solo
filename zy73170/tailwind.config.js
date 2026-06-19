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
          50: "#f7f9fc",
          100: "#eef2f7",
          200: "#d8e0ec",
          300: "#b5c3d7",
          400: "#8aa0c0",
          500: "#667fa6",
          600: "#4f6488",
          700: "#3f516e",
          800: "#36445a",
          900: "#1e3a5f",
          950: "#13233c",
        },
        amber2: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        emerald2: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        coral: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        paper: "#faf8f3",
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        hand: ['"Caveat"', '"Ma Shan Zheng"', 'cursive'],
      },
      boxShadow: {
        card: "0 1px 2px rgba(30,58,95,0.06), 0 1px 3px rgba(30,58,95,0.08)",
        pop: "0 10px 25px -5px rgba(30,58,95,0.15), 0 8px 10px -6px rgba(30,58,95,0.1)",
        inset: "inset 0 0 0 1px rgba(30,58,95,0.06)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseOnce: {
          "0%,100%": { backgroundColor: "rgba(245,158,11,0.0)" },
          "50%": { backgroundColor: "rgba(245,158,11,0.25)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 350ms ease-out both",
        pulseOnce: "pulseOnce 900ms ease-in-out 1",
      },
    },
  },
  plugins: [],
};
