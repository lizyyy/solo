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
          950: '#0B0E12',
          900: '#0E1116',
          850: '#12161C',
          800: '#161B22',
          750: '#1B2129',
          700: '#222A33',
          650: '#273039',
          600: '#2E3742',
          500: '#3D4856',
          400: '#566373',
          300: '#7E8A99',
        },
        accent: { DEFAULT: '#F2B441', soft: '#3A2E16' },
        ok: { DEFAULT: '#3DD6C0', soft: '#10302B' },
        alert: { DEFAULT: '#F26B6B', soft: '#341717' },
        warn: { DEFAULT: '#E7C24B' },
        muted: '#8A95A4',
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 0 0 1px rgba(255,255,255,0.04)',
        'glow-accent': '0 0 0 1px rgba(242,180,65,0.35), 0 0 26px -8px rgba(242,180,65,0.3)',
        'glow-alert': '0 0 0 1px rgba(242,107,107,0.35), 0 0 26px -8px rgba(242,107,107,0.28)',
      },
    },
  },
  plugins: [],
};
