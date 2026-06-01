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
        blueprint: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#1E40AF",
          700: "#1D4ED8",
          800: "#1E3A8A",
          900: "#172554",
        },
        warning: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          300: "#FDBA74",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
        },
        safe: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
        },
        danger: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          300: "#FCA5A5",
          400: "#F87171",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
        },
        ink: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
        },
        grid: "#E5E7EB",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ['"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        "engineering": "2px 2px 0 0 rgba(15, 23, 42, 0.15), 4px 4px 0 0 rgba(15, 23, 42, 0.08)",
        "engineering-sm": "1px 1px 0 0 rgba(15, 23, 42, 0.15)",
        "engineering-hover": "3px 3px 0 0 rgba(30, 64, 175, 0.3), 6px 6px 0 0 rgba(30, 64, 175, 0.15)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "slide-in-right": "slideInRight 0.4s ease-out forwards",
        "stagger-1": "fadeInUp 0.6s ease-out 0.1s forwards",
        "stagger-2": "fadeInUp 0.6s ease-out 0.2s forwards",
        "stagger-3": "fadeInUp 0.6s ease-out 0.3s forwards",
        "stagger-4": "fadeInUp 0.6s ease-out 0.4s forwards",
        "stagger-5": "fadeInUp 0.6s ease-out 0.5s forwards",
        "roll-number": "rollNumber 0.8s ease-out forwards",
        "vs-rotate": "vsRotate 0.5s ease-out forwards",
        "grid-draw": "gridDraw 1.5s ease-out forwards",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        rollNumber: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "50%": { opacity: "0.5", transform: "translateY(-5px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        vsRotate: {
          "0%": { opacity: "0", transform: "rotate(-180deg) scale(0.5)" },
          "100%": { opacity: "1", transform: "rotate(0) scale(1)" },
        },
        gridDraw: {
          "0%": { backgroundPosition: "0 0, 0 0" },
          "100%": { backgroundPosition: "24px 24px, 24px 24px" },
        },
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(to right, var(--grid-color) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-color) 1px, transparent 1px)",
        "blueprint-grid":
          "linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
