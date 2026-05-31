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
        industrial: {
          bg: "#1a1d23",
          "bg-light": "#23272f",
          "bg-lighter": "#2c313a",
          border: "#3a3f4a",
          text: "#e4e6eb",
          "text-muted": "#8b94a3",
          "text-dim": "#5a6270",
        },
        signal: {
          green: "#00d4aa",
          "green-hover": "#00e8bb",
          "green-glow": "rgba(0, 212, 170, 0.3)",
        },
        alert: {
          orange: "#ff9500",
          "orange-hover": "#ffa533",
          "orange-glow": "rgba(255, 149, 0, 0.3)",
        },
        danger: {
          red: "#ff3b30",
          "red-hover": "#ff5549",
          "red-glow": "rgba(255, 59, 48, 0.3)",
        },
        tech: {
          blue: "#0a84ff",
          "blue-hover": "#2997ff",
          "blue-glow": "rgba(10, 132, 255, 0.3)",
        },
        data: {
          purple: "#af52de",
          "purple-hover": "#bf73e6",
          "purple-glow": "rgba(175, 82, 222, 0.3)",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Noto Sans SC", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        "glow-green": "0 0 20px rgba(0, 212, 170, 0.4)",
        "glow-orange": "0 0 20px rgba(255, 149, 0, 0.4)",
        "glow-red": "0 0 20px rgba(255, 59, 48, 0.4)",
        "glow-blue": "0 0 20px rgba(10, 132, 255, 0.4)",
        "glow-purple": "0 0 20px rgba(175, 82, 222, 0.4)",
        "industrial": "0 4px 20px rgba(0, 0, 0, 0.5)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "blink": "blink 1s step-end infinite",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
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
