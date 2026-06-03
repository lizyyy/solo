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
        frost: {
          50: "#F8FAFB",
          100: "#EFF6FF",
          200: "#DBEAFE",
          300: "#BFDBFE",
          400: "#7DD3FC",
          500: "#0EA5E9",
          600: "#0284C7",
          700: "#0369A1",
          800: "#1E293B",
          900: "#0F172A",
        },
        amber: {
          500: "#F59E0B",
        },
        emerald: {
          500: "#10B981",
        },
        rose: {
          500: "#EF4444",
        },
      },
      fontFamily: {
        display: ['"DM Sans"', '"Noto Sans SC"', 'sans-serif'],
        body: ['"Noto Sans SC"', '"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
