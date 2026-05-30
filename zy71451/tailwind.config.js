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
        "space-bg": "#0a0e1a",
        "space-panel": "#1a2332",
        "space-dark": "#0f1822",
        "space-border": "#2a3444",
        "space-text": "#e8edf5",
        "space-muted": "#8a9aaa",
        "space-dim": "#5a6a7a",
        "accent-cyan": "#00f5d4",
        "accent-amber": "#f5a623",
        "accent-purple": "#6c5ce7",
        "accent-pink": "#fd79a8",
        "accent-emerald": "#00b894",
        "accent-red": "#ff6b6b",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
      boxShadow: {
        "glow-cyan": "0 0 12px rgba(0, 245, 212, 0.3)",
        "glow-amber": "0 0 12px rgba(245, 166, 35, 0.3)",
        "glow-purple": "0 0 12px rgba(108, 92, 231, 0.3)",
      },
    },
  },
  plugins: [],
};
