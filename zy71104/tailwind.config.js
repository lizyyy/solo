/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#165DFF',
        danger: '#FF4D4F',
        success: '#52C41A',
        warning: '#FAAD14',
        dark: {
          100: '#1F1F1F',
          200: '#2D2D2D',
          300: '#3D3D3D',
          400: '#4D4D4D',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
