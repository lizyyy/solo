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
        clay: {
          50: '#FAF5EF',
          100: '#F0E6D6',
          200: '#E0D0B8',
          300: '#C9A87C',
          400: '#B8895D',
          500: '#A0522D',
          600: '#8B421F',
          700: '#6E3318',
          800: '#522613',
          900: '#3A1A0D',
        },
        kiln: {
          50: '#FFF3E8',
          100: '#FFE0C2',
          200: '#FFC68A',
          300: '#FFA852',
          400: '#E8740C',
          500: '#C85D00',
          600: '#A04A00',
          700: '#783800',
          800: '#522700',
          900: '#3A1A00',
        },
        slate2: {
          50: '#F7F8FA',
          100: '#E8ECF0',
          200: '#D1D8E0',
          300: '#A0AEC0',
          400: '#718096',
          500: '#4A5568',
          600: '#2D3748',
          700: '#1A202C',
          800: '#131720',
          900: '#0D1117',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
