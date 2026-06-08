/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#2A9D8F',
          orange: '#E9C46A',
          ink: '#264653',
          cream: '#FDF6E3',
        },
        status: {
          release: '#2A9D8F',
          wait: '#F4A261',
          hold: '#E76F51',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        kai: ['"LXGW WenKai"', '"KaiTi"', 'STKaiti', 'serif'],
      },
      borderRadius: {
        card: '16px',
        btn: '10px',
      },
      keyframes: {
        slideDown: {
          '0%': { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        slideDown: 'slideDown 250ms ease both',
        countUp: 'countUp 600ms ease both',
        pulseSoft: 'pulseSoft 1.4s ease-in-out 2',
      },
    },
  },
  plugins: [],
};
