/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
    },
    extend: {
      colors: {
        studio: {
          bg: '#1E1E24',
          surface: '#2A2A33',
          card: '#F8F4E3',
          amber: '#F5A65B',
          amberHover: '#E89548',
          success: '#4CAF50',
          warning: '#FF9800',
          danger: '#E57373',
          text: '#2D2D2D',
          textMuted: '#6B6B6B',
        }
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif"', 'Georgia', 'serif'],
        sans: ['"PingFang SC"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'bounce-in': 'bounceIn 0.4s ease-out',
        'pulse-soft': 'pulseSoft 1.5s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'highlight-fade': 'highlightFade 2s ease-out forwards',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(229, 115, 115, 0.4)' },
          '50%': { boxShadow: '0 0 0 6px rgba(229, 115, 115, 0)' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        highlightFade: {
          '0%': { backgroundColor: 'rgba(245, 166, 91, 0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
};
