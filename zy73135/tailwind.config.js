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
        ocean: {
          950: "#071320",
          900: "#0F2B46",
          800: "#173a5c",
          700: "#1f4a72",
          600: "#2a5e8c",
          500: "#3a78a8",
          400: "#5a94c4",
          300: "#82b4dc",
          200: "#b0d0eb",
          100: "#d6e6f3",
          50: "#edf4fa",
        },
        nautical: {
          warning: "#FF7A45",
          warningLight: "#FFB08A",
          warningDark: "#E5632E",
          success: "#2ECC71",
          successLight: "#6FE0A0",
          successDark: "#27AE60",
          danger: "#E74C3C",
          dangerLight: "#F28A80",
          dangerDark: "#C0392B",
          paper: "#F5E6C8",
          paperDark: "#E8D4A8",
        },
      },
      fontFamily: {
        display: ["'Oswald'", "'Impact'", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
      boxShadow: {
        "glow-orange": "0 0 20px rgba(255, 122, 69, 0.4)",
        "glow-blue": "0 0 20px rgba(58, 120, 168, 0.4)",
        "inner-ocean": "inset 0 2px 8px rgba(7, 19, 32, 0.5)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan-line": "scanLine 2s linear infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "slide-in-up": "slideInUp 0.4s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(255, 122, 69, 0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(255, 122, 69, 0.7)" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
