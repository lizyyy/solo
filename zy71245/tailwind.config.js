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
        paper: {
          50: '#FAF7F0',
          100: '#F5F0E6',
          200: '#E8DFD0',
          300: '#D4C7B0',
          400: '#B8A88D',
        },
        ink: {
          50: '#F5F3F0',
          100: '#5C4A3D',
          200: '#4A3828',
          300: '#3A2A1C',
          400: '#2C1810',
        },
        seal: {
          50: '#FDF2F2',
          100: '#E85D6A',
          200: '#D93A4A',
          300: '#C41E3A',
          400: '#A01830',
        },
        lapis: {
          100: '#5A8BB5',
          200: '#3D6D99',
          300: '#2E5A88',
        },
        bronze: {
          100: '#6B9B78',
          200: '#5A8A68',
          300: '#4A7C59',
        },
      },
      fontFamily: {
        kai: ['KaiTi', 'STKaiti', 'serif'],
        song: ['SimSun', 'STSong', 'serif'],
      },
      boxShadow: {
        'scroll': '0 4px 20px rgba(44, 24, 16, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
        'seal': '0 2px 8px rgba(196, 30, 58, 0.3)',
        'painting': '0 8px 32px rgba(44, 24, 16, 0.2)',
      },
      animation: {
        'scroll-unfold': 'scrollUnfold 1.5s ease-out forwards',
        'ink-spread': 'inkSpread 0.6s ease-out forwards',
        'seal-stamp': 'sealStamp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
      },
      keyframes: {
        scrollUnfold: {
          '0%': { transform: 'scaleY(0.1)', opacity: '0' },
          '100%': { transform: 'scaleY(1)', opacity: '1' },
        },
        inkSpread: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { opacity: '0.8' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        sealStamp: {
          '0%': { transform: 'scale(1.5) rotate(-5deg)', opacity: '0' },
          '50%': { transform: 'scale(0.95) rotate(2deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        fadeInUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
