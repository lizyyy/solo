/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-purple': '#1a0a2e',
        'neon-purple': '#2D1B4E',
        'night': {
          'bg': '#2D1B4E',
          'surface': '#3D2B5E',
          'card': '#4D3B6E',
        },
        'neon': {
          'orange': '#FF6B35',
          'pink': '#FF4D8D',
          'green': '#00FFA3',
          'yellow': '#FFE066',
          'blue': '#4DA6FF',
          'purple': '#9D4EDD',
        }
      },
      fontFamily: {
        'title': ['"ZCOOL KuaiLe"', 'cursive'],
        'display': ['"ZCOOL KuaiLe"', 'cursive'],
        'body': ['"Noto Sans SC"', 'sans-serif'],
      },
      animation: {
        'neon-pulse': 'neon-pulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out',
      },
      keyframes: {
        'neon-pulse': {
          '0%, 100%': { textShadow: '0 0 10px currentColor, 0 0 20px currentColor' },
          '50%': { textShadow: '0 0 20px currentColor, 0 0 40px currentColor' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'neon-orange': '0 0 15px #FF6B35, 0 0 30px rgba(255, 107, 53, 0.5)',
        'neon-pink': '0 0 15px #FF4D8D, 0 0 30px rgba(255, 77, 141, 0.5)',
        'neon-green': '0 0 15px #00FFA3, 0 0 30px rgba(0, 255, 163, 0.5)',
        'neon-purple': '0 0 15px #9D4EDD, 0 0 30px rgba(157, 78, 221, 0.5)',
        'neon-yellow': '0 0 15px #FFE066, 0 0 30px rgba(255, 224, 102, 0.5)',
        'neon-blue': '0 0 15px #4DA6FF, 0 0 30px rgba(77, 166, 255, 0.5)',
      }
    },
  },
  plugins: [],
}
