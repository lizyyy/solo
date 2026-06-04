/** @type {import("tailwindcss").Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: '#1B3A4B',
        accent: '#FF6B35',
        warning: '#FF6B35',
        success: '#10B981',
        danger: '#EF4444',
        muted: '#64748B',
        bg: '#F0F2F5',
        card: '#FFFFFF',
        steel: '#1B3A4B',
        'steel-light': '#2A5A72',
        'safety-orange': '#FF6B35',
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
