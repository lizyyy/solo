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
        ink: {
          50: "#F2F5F9",
          100: "#D9E1EC",
          200: "#A8B8CE",
          300: "#6F86A6",
          400: "#3E5A80",
          500: "#1F3A5F",
          600: "#172C48",
          700: "#0F1E31",
          800: "#0A1522",
          900: "#060D15",
        },
        ochre: {
          50: "#FBF3EC",
          100: "#F4DEC7",
          200: "#E9BA8F",
          300: "#DC9457",
          400: "#C4652B",
          500: "#A24F1E",
          600: "#7D3C15",
          700: "#592B0E",
        },
        moss: {
          50: "#EEF4EF",
          100: "#CFE1D3",
          200: "#9FC3A7",
          300: "#70A47C",
          400: "#4A7C59",
          500: "#375E43",
          600: "#27432F",
          700: "#18291D",
        },
        fog: {
          50: "#FAF9F7",
          100: "#F2EFEA",
          200: "#E8E4DE",
          300: "#D6CFc5",
          400: "#BCB3A5",
          500: "#9E9484",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ['"JetBrains Mono"', '"SF Mono"', "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,30,49,0.06), 0 4px 12px rgba(15,30,49,0.06)",
        "card-hover": "0 2px 4px rgba(15,30,49,0.08), 0 8px 24px rgba(15,30,49,0.10)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.6)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseBorder: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(196,101,43,0.35)" },
          "50%": { boxShadow: "0 0 0 6px rgba(196,101,43,0)" },
        },
        flipY: {
          "0%": { transform: "rotateY(0deg)" },
          "50%": { transform: "rotateY(15deg)" },
          "100%": { transform: "rotateY(0deg)" },
        },
        glow: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(31,58,95,0.15)" },
          "50%": { boxShadow: "0 0 18px 2px rgba(31,58,95,0.35)" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 500ms ease-out both",
        "pulse-border": "pulseBorder 1.2s ease-out 1",
        "flip-y": "flipY 400ms ease-out",
        glow: "glow 1.6s ease-in-out",
      },
    },
  },
  plugins: [],
};
