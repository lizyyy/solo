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
        brand: {
          bg: "#0A0E1A",
          surface: "#111827",
          card: "#1A1F35",
          border: "#2A3050",
          orange: "#FF6B35",
          cyan: "#00E5FF",
          green: "#00E676",
          amber: "#FFD600",
          red: "#FF1744",
          muted: "#6B7280",
          text: "#E5E7EB",
        },
      },
      fontFamily: {
        display: ["Orbitron", "monospace"],
        body: ["Noto Sans SC", "sans-serif"],
      },
      animation: {
        "pulse-green": "pulseGreen 2s ease-in-out infinite",
        "pulse-red": "pulseRed 1s ease-in-out infinite",
        "glow-cyan": "glowCyan 2s ease-in-out infinite",
        "scan-line": "scanLine 2s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
      },
      keyframes: {
        pulseGreen: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0, 230, 118, 0.4)" },
          "50%": { boxShadow: "0 0 20px 4px rgba(0, 230, 118, 0.2)" },
        },
        pulseRed: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255, 23, 68, 0.4)" },
          "50%": { boxShadow: "0 0 20px 4px rgba(255, 23, 68, 0.3)" },
        },
        glowCyan: {
          "0%, 100%": { textShadow: "0 0 8px rgba(0, 229, 255, 0.3)" },
          "50%": { textShadow: "0 0 20px rgba(0, 229, 255, 0.6)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
