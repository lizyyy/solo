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
        ocean: {
          50: '#F0F4FA',
          100: '#D6E0F0',
          200: '#ADC1E1',
          300: '#84A2D1',
          400: '#5B83C2',
          500: '#3265B3',
          600: '#0A2463',
          700: '#081D4E',
          800: '#061639',
          900: '#040E24',
        },
        alert: {
          missed: '#D62828',
          conflict: '#F77F00',
          fuel: '#FCBF49',
          success: '#38B000',
          info: '#0077B6',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        digital: ['Orbitron', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(10, 36, 99, 0.1), 0 2px 4px -1px rgba(10, 36, 99, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(10, 36, 99, 0.15), 0 4px 6px -2px rgba(10, 36, 99, 0.1)',
        'button': '0 2px 4px rgba(0, 0, 0, 0.2)',
        'button-hover': '0 4px 8px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
