/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Hanken Grotesk"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        "ink-mute": "var(--ink-mute)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        anomaly: "var(--anomaly)",
        "anomaly-soft": "var(--anomaly-soft)",
        "unit-missing": "var(--unit-missing)",
        "unit-missing-soft": "var(--unit-missing-soft)",
        "old-version": "var(--old-version)",
        "old-version-soft": "var(--old-version-soft)",
        normal: "var(--normal)",
        "normal-soft": "var(--normal-soft)",
        verbal: "var(--verbal)",
        "verbal-soft": "var(--verbal-soft)",
      },
      borderRadius: {
        atlas: "3px",
      },
      boxShadow: {
        atlas: "0 1px 0 0 var(--line), 0 1px 2px rgba(0,0,0,0.04)",
        "atlas-lift": "0 2px 0 0 var(--line-strong), 0 8px 24px -12px rgba(0,0,0,0.18)",
      },
    },
  },
  plugins: [],
};
