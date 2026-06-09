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
        clinic: {
          50: '#EFFAFB',
          100: '#D6F2F3',
          200: '#ADE4E6',
          300: '#7BD4D7',
          400: '#3DBCC0',
          500: '#0EA5A8',
          600: '#0A8B8E',
          700: '#0D6F72',
          800: '#11595B',
          900: '#124A4C',
          950: '#082E2F',
        },
        ink: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', 'ui-serif', 'Georgia', 'serif'],
        body: ['"JetBrains Mono"', '"PingFang SC"', 'ui-monospace', 'SFMono-Regular'],
        sans: ['"PingFang SC"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'btn-press': '0 2px 0 0 rgba(0,0,0,0.15)',
        'btn-hover': '0 4px 14px -2px rgba(14,165,168,0.45)',
        'card-lift': '0 8px 30px -6px rgba(15,23,42,0.12)',
        'glow-clinic': '0 0 0 3px rgba(14,165,168,0.18)',
      },
      backgroundImage: {
        'header-grad': 'linear-gradient(135deg, #0EA5A8 0%, #0D6F72 55%, #1E293B 100%)',
        'progress-shine': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
      },
      keyframes: {
        pulse3: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(14,165,168,0.45)' },
          '50%': { boxShadow: '0 0 0 10px rgba(14,165,168,0)' },
        },
        flashRow: {
          '0%, 100%': { backgroundColor: 'rgba(255,255,255,0)' },
          '25%': { backgroundColor: 'rgba(251, 191, 36, 0.45)' },
          '75%': { backgroundColor: 'rgba(251, 191, 36, 0.45)' },
        },
        warnSpin: {
          '0%, 100%': { transform: 'rotate(-8deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        gapBeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        shine: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        halo: {
          '0%': { boxShadow: '0 0 0 0 rgba(139, 92, 246, 0.6)', opacity: '1' },
          '100%': { boxShadow: '0 0 0 20px rgba(139, 92, 246, 0)', opacity: '0' },
        },
      },
      animation: {
        pulse3: 'pulse3 1.4s ease-in-out 3',
        flashRow: 'flashRow 1.5s ease-in-out',
        warnSpin: 'warnSpin 1.6s ease-in-out infinite',
        gapBeat: 'gapBeat 1.2s ease-in-out infinite',
        shine: 'shine 2s ease-in-out infinite',
        halo: 'halo 0.9s ease-out forwards',
      },
    },
  },
  plugins: [],
};
