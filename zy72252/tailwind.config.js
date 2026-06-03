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
          50: "#E6F0FF",
          100: "#C9DBFF",
          500: "#165DFF",
          600: "#0E42D2",
          700: "#0A2CA6",
        },
        warning: {
          50: "#FFF7E6",
          100: "#FFE8BF",
          500: "#FF7D00",
          600: "#D45F00",
        },
        success: {
          500: "#00B42A",
        },
        error: {
          500: "#F53F3F",
        },
        industrial: {
          50: "#F7F8FA",
          100: "#E5E6EB",
          200: "#C9CDD4",
          300: "#86909C",
          400: "#4E5969",
          500: "#272E3B",
          600: "#1D2129",
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce 2s infinite',
      },
      boxShadow: {
        'industrial': '0 4px 20px rgba(22, 93, 255, 0.15)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.08)',
      }
    },
  },
  plugins: [],
};
