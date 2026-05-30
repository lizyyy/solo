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
            50: "#eef4fb",
            100: "#d7e4f3",
            200: "#b7cfe7",
            300: "#8bb3d7",
            400: "#598fc2",
            500: "#3b71a8",
            600: "#2a5887",
            700: "#1e3a5f",
            800: "#16283d",
            900: "#0f172a",
            950: "#0a0f1a",
          },
          problem: {
            overlap: "#f59e0b",
            misalignment: "#ef4444",
            noise: "#8b5cf6",
          },
          status: {
            confirmed: "#10b981",
            rejected: "#64748b",
            pending: "#fbbf24",
          },
          source: {
            system: "#3b82f6",
            manual: "#f97316",
          },
          bg: {
            page: "#0a0f1a",
            card: "#0f172a",
            subtle: "#16283d",
          },
          text: {
            primary: "#e2e8f0",
            secondary: "#94a3b8",
            tertiary: "#64748b",
          },
          border: {
            DEFAULT: "#1e3a5f",
            hover: "#2a5887",
          },
        },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Noto Sans SC", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
