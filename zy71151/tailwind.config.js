/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'navy': {
          50: '#e6f0ff',
          100: '#b3d1ff',
          200: '#80b3ff',
          300: '#4d94ff',
          400: '#1a75ff',
          500: '#0A2463',
          600: '#081c4e',
          700: '#061539',
          800: '#040e24',
          900: '#02070f',
        },
        'harbor': {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#3E5C76',
          600: '#2d4a5e',
          700: '#1f3244',
          800: '#13202e',
          900: '#0a0e17',
        },
        'warning': {
          50: '#fff4e6',
          100: '#ffe0b3',
          200: '#ffcc80',
          300: '#ffb84d',
          400: '#ffa31a',
          500: '#F77F00',
          600: '#c56600',
          700: '#934c00',
          800: '#623300',
          900: '#311900',
        }
      },
      fontFamily: {
        'oswald': ['Oswald', 'sans-serif'],
        'mono': ['Roboto Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
