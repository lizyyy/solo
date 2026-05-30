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
          50: "#E8F3FF",
          100: "#B9D8FF",
          200: "#8ABDFF",
          300: "#5BA2FF",
          400: "#2C87FF",
          500: "#165DFF",
          600: "#0E42D2",
          700: "#0A2BA0",
          800: "#061D6E",
          900: "#030F3C",
        },
        warning: {
          50: "#FFF7E8",
          100: "#FFE8B9",
          200: "#FFD88A",
          300: "#FFC95B",
          400: "#FFB92C",
          500: "#FF7D00",
          600: "#C96300",
          700: "#974A00",
          800: "#653100",
          900: "#341900",
        },
        success: {
          50: "#E8FFF0",
          100: "#B9FFD0",
          200: "#8AFFB0",
          300: "#5BFF90",
          400: "#2CFF70",
          500: "#00B42A",
          600: "#00992A",
          700: "#007D2A",
          800: "#00622A",
          900: "#00462A",
        },
        danger: {
          50: "#FFE8E8",
          100: "#FFB9B9",
          200: "#FF8A8A",
          300: "#FF5B5B",
          400: "#FF2C2C",
          500: "#F53F3F",
          600: "#CB2634",
          700: "#A01929",
          800: "#760E1F",
          900: "#4B0614",
        },
        slate: {
          50: "#F7F8FA",
          100: "#F2F3F5",
          200: "#E5E6EB",
          300: "#C9CDD4",
          400: "#86909C",
          500: "#4E5969",
          600: "#272E3B",
          700: "#1D2129",
          800: "#171A21",
          900: "#0F1115",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        sans: ['"Inter"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shake": "shake 0.5s ease-in-out",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(22, 93, 255, 0.3)" },
          "100%": { boxShadow: "0 0 20px rgba(22, 93, 255, 0.6)" },
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)",
        "card-hover": "0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.06)",
        glow: "0 0 20px rgba(22, 93, 255, 0.4)",
      },
      backgroundImage: {
        "gradient-mesh":
          "radial-gradient(at 0% 0%, hsla(221,100%,74%,0.15) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(260,100%,74%,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(221,100%,74%,0.15) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(260,100%,74%,0.15) 0px, transparent 50%)",
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
