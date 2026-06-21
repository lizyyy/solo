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
        abyss: {
          900: "#04101a",
          800: "#06141c",
          700: "#0a1f2b",
          600: "#0e2a3a",
          500: "#133447",
        },
        glow: {
          cyan: "#38e1d6",
          teal: "#1f7a78",
          deep: "#0c5e63",
        },
        signal: {
          amber: "#f5b342",
          coral: "#ff5d5d",
          moon: "#e6f4f1",
        },
      },
      fontFamily: {
        display: ['"Manrope"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: "0 0 24px rgba(56,225,214,0.35)",
        'glow-coral': "0 0 24px rgba(255,93,93,0.45)",
        'glow-amber': "0 0 24px rgba(245,179,66,0.4)",
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.8)', opacity: '0.9' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        riseIn: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 1.8s ease-out infinite',
        breathe: 'breathe 2.4s ease-in-out infinite',
        riseIn: 'riseIn 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};
