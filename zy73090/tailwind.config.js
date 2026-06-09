/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0F172A",
          soft: "#111827",
          card: "#1E293B",
          elevated: "#273449",
          border: "#334155",
        },
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
        },
        status: {
          pending: "#64748B",
          in_progress: "#3B82F6",
          completed: "#10B981",
          has_legacy: "#F59E0B",
          approved: "#10B981",
          needs_modify: "#F59E0B",
          rejected: "#EF4444",
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', '"Noto Sans SC"', "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-x": {
          "0%": { transform: "translateX(-8px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.45s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.3s ease-out both",
        "scale-in": "scale-in 0.25s ease-out both",
        "slide-x": "slide-x 0.3s ease-out both",
      },
      boxShadow: {
        card: "0 4px 20px -8px rgba(0,0,0,0.45)",
        hover: "0 8px 30px -10px rgba(37,99,235,0.35)",
      },
    },
  },
  plugins: [],
};
