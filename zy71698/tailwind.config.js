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
          primary: "#1a1a1e",
          secondary: "#3b4252",
          tertiary: "#2d3748",
        },
        accent: {
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
        },
        text: {
          primary: "#e5e7eb",
          secondary: "#9ca3af",
          muted: "#6b7280",
        },
        track: {
          timeline: "#3b82f6",
          dialog: "#8b5cf6",
          music: "#ec4899",
          cue: "#10b981",
          note: "#f59e0b",
        },
      },
      fontFamily: {
        mono: ["Space Mono", "ui-monospace", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-in": "slideIn 0.3s ease-out",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
