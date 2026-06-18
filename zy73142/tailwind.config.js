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
        sea: {
          deep: '#0B3D4F',
          mid: '#165A72',
          light: '#4A90B8',
          foam: '#8EC5D9',
        },
        kelp: {
          DEFAULT: '#3BAF7B',
          dark: '#2A8A5E',
          soft: '#7BCFA6',
        },
        amber: {
          tide: '#E8913A',
          soft: '#F3B56E',
        },
        coral: {
          DEFAULT: '#D9534F',
          soft: '#E98682',
        },
        sand: {
          DEFAULT: '#F4EFE6',
          warm: '#E8DFC9',
          tide: '#C9B896',
        },
        ink: {
          DEFAULT: '#0E1F27',
          soft: '#2A3E48',
        }
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'soft': '0 8px 28px -8px rgba(11,61,79,0.25)',
        'glow-kelp': '0 0 0 3px rgba(59,175,123,0.35)',
        'glow-coral': '0 0 0 3px rgba(217,83,79,0.35)',
      },
      backgroundImage: {
        'ocean-gradient': 'radial-gradient(1200px 600px at 10% -10%, #165A72 0%, #0B3D4F 45%, #0E1F27 100%)',
        'sand-grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.08 0 0 0 0 0.12 0 0 0 0 0.15 0 0 0 0.25 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        drawLine: {
          '0%': { strokeDashoffset: '2000' },
          '100%': { strokeDashoffset: '0' },
        },
        blinkDiff: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(217,83,79,0.0)' },
          '50%': { boxShadow: '0 0 0 3px rgba(217,83,79,0.55)' },
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-3px)' },
        },
      },
      animation: {
        drawLine: 'drawLine 1.6s ease-out forwards',
        blinkDiff: 'blinkDiff 0.9s ease-in-out 3',
        floaty: 'floaty 3.5s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};
