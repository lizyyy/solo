/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f5fa',
          100: '#d9e4f2',
          200: '#b3c9e5',
          300: '#80a8d4',
          400: '#4d87c3',
          500: '#2b6aa8',
          600: '#1e5487',
          700: '#1e3a5f',
          800: '#162c47',
          900: '#0f1e30',
        },
        gold: {
          50: '#fdf9e6',
          100: '#faf0c2',
          200: '#f5e089',
          300: '#eecb4b',
          400: '#d4af37',
          500: '#b8942d',
          600: '#937325',
          700: '#71571e',
          800: '#5a451b',
          900: '#4d3b1a',
        },
        status: {
          pending: '#94a3b8',
          pledged: '#2563eb',
          extended: '#7c3aed',
          matured: '#f59e0b',
          released: '#10b981',
          to_confirm: '#ef4444',
          closed: '#64748b'
        }
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
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
}
