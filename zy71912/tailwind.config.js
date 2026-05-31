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
          primary: "#1a1a1a",
          secondary: "#252525",
          tertiary: "#2e2e2e",
        },
        text: {
          primary: "#f5f1e8",
          secondary: "#c9c5bc",
          muted: "#8a8780",
        },
        status: {
          confirmed: "#2d5a4a",
          confirmedBg: "rgba(45, 90, 74, 0.15)",
          pending: "#8b4513",
          pendingBg: "rgba(139, 69, 19, 0.15)",
          manual: "#3b4a8b",
          manualBg: "rgba(59, 74, 139, 0.15)",
          anomaly: "#c2410c",
          anomalyBg: "rgba(194, 65, 12, 0.15)",
        },
        track: {
          guest: "#4a7c59",
          clip: "#8b6914",
          ad: "#7c3a4a",
        },
        border: {
          primary: "#404040",
          secondary: "#525252",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Noto Sans SC", "system-ui", "sans-serif"],
      },
      borderRadius: {
        none: "0px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-in": "slideIn 0.4s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateX(-10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
