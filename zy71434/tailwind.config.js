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
        primary: {
          orange: '#FF8C42',
          purple: '#7B2D8E',
        },
        success: '#4CAF50',
        danger: '#FF5252',
        bg: {
          deep: '#1A1A2E',
          card: '#16213E',
          surface: '#0F3460',
        },
        note: {
          do: '#FF5252',
          re: '#FF8C42',
          mi: '#FFD93D',
          fa: '#4CAF50',
          sol: '#42A5F5',
          la: '#AB47BC',
          si: '#F06292',
        },
      },
      fontFamily: {
        display: ['Fredoka', 'sans-serif'],
        body: ['Noto Sans SC', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'bounce-in': 'bounceIn 0.4s ease-out',
        'shake': 'shake 0.5s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
        'star-twinkle': 'starTwinkle 2s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 140, 66, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 140, 66, 0.6)' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-8px)' },
          '75%': { transform: 'translateX(8px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        starTwinkle: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
      },
    },
  },
  plugins: [],
};
