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
        bg: {
          primary: '#0f0f1a',
          secondary: '#1a1a2e',
          card: '#1e1e35',
          input: '#252542',
        },
        border: '#2d2d4a',
        txt: {
          primary: '#e8e8f0',
          secondary: '#9898b0',
          muted: '#6b6b85',
        },
        amber: {
          DEFAULT: '#f59e0b',
          dim: 'rgba(245, 158, 11, 0.15)',
        },
        laser: {
          green: '#10b981',
          greenDim: 'rgba(16, 185, 129, 0.15)',
          red: '#ef4444',
          redDim: 'rgba(239, 68, 68, 0.15)',
          blue: '#3b82f6',
          blueDim: 'rgba(59, 130, 246, 0.15)',
          purple: '#8b5cf6',
          purpleDim: 'rgba(139, 92, 246, 0.15)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
