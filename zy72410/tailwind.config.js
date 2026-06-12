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
        studio: {
          black: '#121212',
          dark: '#1A1A1A',
          darker: '#0F0F0F',
          red: '#E63946',
          gold: '#D4AF37',
          goldLight: '#E8C872',
          gray: '#2A2A2A',
          silver: '#B8B8B8',
        },
        status: {
          reused: '#6B7280',
          new: '#10B981',
          conflict: '#F59E0B',
          rework: '#8B5CF6',
          normal: '#3B82F6',
          completed: '#059669',
          pending: '#6B7280',
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'level-indicator': 'levelIndicator 1.5s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'waveform': 'waveform 1.2s ease-in-out infinite',
      },
      keyframes: {
        levelIndicator: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        waveform: {
          '0%, 100%': { height: '8px' },
          '50%': { height: '24px' },
        },
      },
      clipPath: {
        'notch': 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
      },
      backgroundImage: {
        'vinyl': 'radial-gradient(circle, #2A2A2A 0%, #1A1A1A 70%, #121212 100%)',
        'grain': 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.05\'/%3E%3C/svg%3E")',
      },
    },
  },
  plugins: [],
};
