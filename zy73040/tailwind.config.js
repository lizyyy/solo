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
        navy: {
          50: '#F0F4FA',
          100: '#D6E0F0',
          200: '#ADBFE1',
          300: '#6B85B5',
          400: '#3F5A8A',
          500: '#0A2342',
          600: '#081C36',
          700: '#061529',
          800: '#040E1D',
          900: '#02070F',
        },
        coral: {
          50: '#FFF0ED',
          100: '#FFD6CC',
          200: '#FFAD99',
          300: '#FF8566',
          400: '#FF6B4A',
          500: '#E85538',
          600: '#B84027',
          700: '#8A2E1A',
        },
        jade: {
          50: '#EBFAF2',
          100: '#C6F0D9',
          200: '#8DE1B4',
          300: '#54D28E',
          400: '#2ECC71',
          500: '#24A85D',
          600: '#1A8047',
        },
        amber: {
          50: '#FFF7E8',
          100: '#FFEABF',
          200: '#FFD47F',
          300: '#FFBF3F',
          400: '#F4A423',
          500: '#CD8511',
          600: '#996300',
        },
        coolgray: {
          50: '#F7F9FA',
          100: '#E8ECEF',
          200: '#D1D7DE',
          300: '#A9B2BD',
          400: '#838F9C',
          500: '#5C6A79',
          600: '#3F4A55',
          700: '#2D3748',
          800: '#1E2530',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Source Han Sans CN"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(10, 35, 66, 0.06), 0 1px 3px 1px rgba(10, 35, 66, 0.04)',
        'card-hover': '0 4px 6px -1px rgba(10, 35, 66, 0.08), 0 2px 4px -2px rgba(10, 35, 66, 0.06)',
        inner: 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.08)',
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'flash-highlight': {
          '0%': { backgroundColor: 'rgb(255 214 204 / 0.0)' },
          '20%': { backgroundColor: 'rgb(255 214 204 / 0.6)' },
          '100%': { backgroundColor: 'rgb(255 214 204 / 0.0)' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'slide-down': 'slide-down 0.25s ease-out',
        'flash-highlight': 'flash-highlight 1.5s ease-out',
      },
    },
  },
  plugins: [],
};
