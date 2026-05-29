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
        film: {
          bg: "#0a0a14",
          panel: "#12121f",
          card: "#1a1a2e",
          border: "#2a2a4a",
          primary: "#e94560",
          secondary: "#0f3460",
          accent: "#16213e",
          text: {
            primary: "#e8e8e8",
            secondary: "#a0a0b0",
            muted: "#606080",
          },
          success: "#4ade80",
          warning: "#fbbf24",
          danger: "#ef4444",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'film-roll': 'filmRoll 20s linear infinite',
      },
      keyframes: {
        filmRoll: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100px' },
        },
      },
    },
  },
  plugins: [],
};
