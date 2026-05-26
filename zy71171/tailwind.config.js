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
        cold: {
          bg: "#0b1220",
          panel: "#111a2e",
          line: "#1e2a44",
          text: "#cbd5e1",
          mute: "#64748b",
        },
      },
      fontFamily: {
        display: ['"Rajdhani"', '"Orbitron"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(56,189,248,0.25), 0 10px 30px -10px rgba(14,165,233,0.35)",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        flash: {
          "0%": { backgroundColor: "rgba(239,68,68,0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        pulseSoft: "pulseSoft 1.6s ease-in-out infinite",
        flash: "flash 0.6s ease-out",
      },
    },
  },
  plugins: [],
};
