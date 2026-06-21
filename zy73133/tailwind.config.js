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
          deep: "#0b1a2b",
          surface: "#14263f",
          line: "#1f4068",
          mid: "#0f2f52",
        },
        glow: {
          cyan: "#25d0c0",
          cyanDim: "#15918a",
        },
        buoy: {
          red: "#ff5e62",
          redDim: "#b23a3d",
          yellow: "#ffc93c",
          yellowDim: "#c79816",
          green: "#38d39f",
          greenDim: "#1f8e69",
        },
        console: {
          text: "#cfe8ff",
          muted: "#7a9ec5",
          dim: "#4a6890",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(37, 208, 192, 0.4), 0 0 18px -4px rgba(37, 208, 192, 0.35)",
        "glow-red": "0 0 0 1px rgba(255, 94, 98, 0.45), 0 0 18px -4px rgba(255, 94, 98, 0.35)",
        "glow-yellow": "0 0 0 1px rgba(255, 201, 60, 0.45), 0 0 18px -4px rgba(255, 201, 60, 0.3)",
      },
      clipPath: {
        bevel: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
      },
      animation: {
        breathe: "breathe 2.4s ease-in-out infinite",
        blink: "blink 0.9s step-end infinite",
        scanline: "scanline 6s linear infinite",
      },
      keyframes: {
        breathe: {
          "0%,100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities, e }) {
      addUtilities({
        ".clip-bevel": {
          clipPath:
            "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
        },
        ".clip-bevel-sm": {
          clipPath:
            "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
        },
        ".grain": {
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.14  0 0 0 0 0.31  0 0 0 0 0.55  0 0 0 0.08 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        },
      });
    },
  ],
};
