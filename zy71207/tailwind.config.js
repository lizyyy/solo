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
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1e40af",
          800: "#1e3a5f",
          900: "#0f172a",
          950: "#0a0f1a",
        },
        accent: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        dark: {
          bg: "#0a0f1a",
          surface: "#111827",
          card: "#1f2937",
          border: "#374151",
          text: "#e5e7eb",
          muted: "#9ca3af",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Noto Sans SC", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(37, 99, 235, 0.5)" },
          "100%": { boxShadow: "0 0 20px rgba(37, 99, 235, 0.8)" },
        },
      },
    },
  },
  plugins: [],
};
