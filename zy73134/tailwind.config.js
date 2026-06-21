/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        deepsea: {
          50: '#E8F4FF',
          100: '#C9E2F5',
          200: '#8AB8D9',
          300: '#5A8EB8',
          400: '#3A6A90',
          500: '#23486B',
          600: '#163452',
          700: '#0E2A44',
          800: '#0A1F35',
          900: '#0A2540',
          950: '#051225',
        },
        teal: {
          glow: '#00D4AA',
        },
        coral: {
          DEFAULT: '#FF7A45',
          glow: '#FF7A45',
        },
        alert: {
          red: '#FF5A5F',
          yellow: '#FFB703',
          green: '#34D399',
          gray: '#8A94A6',
        },
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Noto Sans SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'teal-glow': '0 0 12px rgba(0, 212, 170, 0.5), 0 0 24px rgba(0, 212, 170, 0.25)',
        'coral-glow': '0 0 12px rgba(255, 122, 69, 0.5), 0 0 24px rgba(255, 122, 69, 0.25)',
        'red-glow': '0 0 10px rgba(255, 90, 95, 0.45)',
        'yellow-glow': '0 0 10px rgba(255, 183, 3, 0.45)',
      },
      textShadow: {
        'teal-glow': '0 0 8px rgba(0, 212, 170, 0.7)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0, 212, 170, 0.4)' },
          '50%': { boxShadow: '0 0 18px rgba(0, 212, 170, 0.8)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
