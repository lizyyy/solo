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
          50: '#f0f7f7',
          100: '#d9eaea',
          200: '#b3d5d5',
          300: '#86b8b8',
          400: '#578f8f',
          500: '#3a6b6b',
          600: '#2d5555',
          700: '#1a3a3a',
          800: '#0f2525',
          900: '#071212',
        },
        accent: {
          50: '#fdf8f3',
          100: '#f8ede0',
          200: '#f0d9bf',
          300: '#e5be94',
          400: '#d9a066',
          500: '#c49a6c',
          600: '#a67c50',
          700: '#856140',
          800: '#634830',
          900: '#3a2a1c',
        },
        danger: {
          50: '#fdf5f3',
          100: '#fbe5df',
          200: '#f5c4b9',
          300: '#ed9a8a',
          400: '#e26f5c',
          500: '#b4543c',
          600: '#9a4430',
          700: '#7a3425',
          800: '#5a251b',
          900: '#3a1610',
        },
        success: {
          50: '#f0faf4',
          100: '#d9f1e2',
          200: '#b3e3c7',
          300: '#82cf9f',
          400: '#4eb578',
          500: '#2d6a4f',
          600: '#235640',
          700: '#1a4231',
          800: '#112d21',
          900: '#081811',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.06)',
        'button': '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
      },
      transitionTimingFunction: {
        'bounce-subtle': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
