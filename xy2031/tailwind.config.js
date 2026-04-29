/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'theme-beijing': {
          primary: '#C41E3A',
          secondary: '#FFD700',
          accent: '#8B4513',
          bg: '#FFF5E6',
        },
        'theme-shanghai': {
          primary: '#1E90FF',
          secondary: '#FF6B6B',
          accent: '#4ECDC4',
          bg: '#F0F8FF',
        },
        'theme-guangzhou': {
          primary: '#FF6B6B',
          secondary: '#FFD93D',
          accent: '#6BCB77',
          bg: '#FFF5F5',
        },
        'theme-dali': {
          primary: '#4A90A4',
          secondary: '#A8E6CF',
          accent: '#FFD3B6',
          bg: '#E8F4F8',
        },
        'theme-xinjiang': {
          primary: '#2E8B57',
          secondary: '#87CEEB',
          accent: '#DDA0DD',
          bg: '#F5FFFA',
        }
      }
    },
  },
  plugins: [],
}
