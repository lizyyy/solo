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
        teal: {
          950: '#0F4C5C',
          900: '#1A5C6E',
          800: '#2A7A8E',
          700: '#3A98AE',
          600: '#4AB6CE',
          500: '#5AC4DE',
          100: '#D4F0F7',
          50: '#EAF8FB',
        },
        amber: {
          600: '#E36414',
          500: '#F07B3F',
          400: '#F4A261',
          100: '#FDE8D0',
          50: '#FFF4EB',
        },
        navy: {
          950: '#1A1A2E',
          900: '#16213E',
          800: '#0F3460',
        },
        slate: {
          150: '#E8E8E8',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
