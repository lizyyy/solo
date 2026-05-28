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
        charcoal: {
          50: "#F5F5F7",
          100: "#E8E8EC",
          200: "#C6C6D1",
          300: "#9494A3",
          400: "#5E5E70",
          500: "#3A3A4A",
          600: "#2A2A3A",
          700: "#1E1E2E",
          800: "#16213E",
          900: "#1A1A2E",
        },
        cyan: {
          50: "#E6FFFA",
          100: "#B2F5EC",
          200: "#66EBD7",
          300: "#00F5D4",
          400: "#00D4B8",
          500: "#00B39B",
        },
        amber: {
          50: "#FFF7E6",
          100: "#FFE9B3",
          200: "#FFD466",
          300: "#F5A623",
          400: "#D48A17",
          500: "#B36F0E",
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
