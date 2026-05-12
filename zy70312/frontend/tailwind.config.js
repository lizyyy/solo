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
        success: '#00B42A',
        warning: '#FF7D00',
        danger: '#F53F3F',
        'gray-100': '#F2F3F5',
        'gray-200': '#E5E6EB',
        'gray-300': '#C9CDD4',
        'gray-400': '#86909C',
        'gray-500': '#4E5969',
        'gray-600': '#272E3B',
        'gray-700': '#1D2129',
      }
    },
  },
  plugins: [],
}
