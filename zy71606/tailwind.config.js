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
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          card: "var(--bg-card)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
        },
        accent: "var(--accent)",
        border: "var(--border)",
        safe: "var(--safe)",
        warning: "var(--warning)",
        "margin-call": "var(--margin-call)",
        "force-liq": "var(--force-liq)",
      },
      spacing: {
        sidebar: "240px",
        "sidebar-collapsed": "64px",
        "topbar": "56px",
      },
      fontFamily: {
        heading: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "SF Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
