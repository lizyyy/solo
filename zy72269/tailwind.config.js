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
          50: "#E8F0FC",
          100: "#D0E1F9",
          200: "#A1C3F3",
          300: "#73A5ED",
          400: "#4487E7",
          500: "#0A2463",
          600: "#081C4E",
          700: "#06153A",
          800: "#040E27",
          900: "#020713",
        },
        accent: {
          warning: "#E63946",
          success: "#2A9D8F",
          info: "#3E92CC",
        },
        neutral: {
          dark: "#1D3557",
          light: "#F1FAEE",
          mid: "#457B9D",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 15px rgba(10, 36, 99, 0.5)',
        'glow-warning': '0 0 15px rgba(230, 57, 70, 0.5)',
        'glow-success': '0 0 15px rgba(42, 157, 143, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1.5s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        }
      }
    },
  },
  plugins: [],
};
