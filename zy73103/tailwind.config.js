/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: {
          950: '#060b17',
          900: '#0b1220',
          850: '#0f1a2d',
        },
      },
      fontFamily: {
        display: ['"Chakra Petch"', '"Noto Sans SC"', 'sans-serif'],
        sans: ['"Noto Sans SC"', '"Chakra Petch"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        hud: '0 0 30px -6px rgba(59,130,246,0.5)',
        'hud-red': '0 0 28px -7px rgba(239,68,68,0.65)',
        'hud-amber': '0 0 28px -7px rgba(245,158,11,0.65)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
