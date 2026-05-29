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
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#bcccdc",
          300: "#9fb3c8",
          400: "#829ab1",
          500: "#627d98",
          600: "#486581",
          700: "#334e68",
          800: "#1e3a5f",
          900: "#102a43",
        },
        accent: {
          50: "#e6f0fa",
          100: "#c5dcf5",
          200: "#9cc2ed",
          300: "#6ea5e3",
          400: "#4a8cdb",
          500: "#2d7dd2",
          600: "#1e68b8",
          700: "#175294",
          800: "#133f72",
          900: "#0e2d51",
        },
        conflict: {
          date: "#e67e22",
          withdrawn: "#e74c3c",
          position: "#f39c12",
        },
        success: {
          500: "#27ae60",
          600: "#229954",
        },
        neutral: {
          50: "#f8f9fa",
          100: "#f1f3f5",
          200: "#e9ecef",
          300: "#dee2e6",
          400: "#ced4da",
          500: "#adb5bd",
          600: "#868e96",
          700: "#495057",
          800: "#343a40",
          900: "#212529",
        },
      },
      fontFamily: {
        display: ["'Noto Serif SC'", "'Source Han Serif SC'", "serif"],
        body: ["'Noto Sans SC'", "'Source Han Sans SC'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        "card-hover": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        table: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
};
