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
        drum: {
          bg: '#141210',
          card: '#1e1a16',
          cardHover: '#2a2420',
          border: '#3a3228',
          borderLight: '#4a4038',
          copper: '#c8956a',
          copperLight: '#daa87d',
          copperDark: '#a07050',
          amber: '#d4a030',
          green: '#4a9e6a',
          greenDark: '#2a6e4a',
          red: '#c05050',
          redDark: '#903030',
          text: '#e8e0d8',
          textMuted: '#9a8e82',
          textDim: '#6a5e52',
        }
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Source Sans 3', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
