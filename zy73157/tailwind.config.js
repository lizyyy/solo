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
        deepsea: {
          50: "#E8F0F8",
          100: "#C7D9EC",
          200: "#98B8DA",
          300: "#5F87B8",
          400: "#30568A",
          500: "#0A2540",
          600: "#081E34",
          700: "#061627",
          800: "#040E1A",
          900: "#02060D",
        },
        status: {
          processed: "#2A9D8F",
          pending: "#F4A261",
          blocked: "#E63946",
          drift: "#F77F00",
          anomaly: "#E63946",
          withdrawn: "#6C757D",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        typewriter: ["Courier Prime", "Courier", "ui-monospace", "monospace"],
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(42, 157, 143, 0.25)",
        danger: "0 0 20px rgba(230, 57, 70, 0.35)",
      },
      animation: {
        pulseSlow: "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        driftBlink: "driftBlink 1.6s ease-in-out infinite",
      },
      keyframes: {
        driftBlink: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.75" },
        },
      },
    },
  },
  plugins: [],
};
