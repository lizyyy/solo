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
        fire: {
          50:  "#FFF1F2",
          100: "#FFE1E3",
          200: "#FEC7CB",
          300: "#FBA0A6",
          400: "#F56B75",
          500: "#D7263D",
          600: "#B91C2F",
          700: "#A4161A",
          800: "#7F1118",
          900: "#5A0C11",
        },
        navy: {
          50:  "#EEF1F8",
          100: "#D8DFEF",
          200: "#B2BEDF",
          300: "#8595C7",
          400: "#5A6DA8",
          500: "#1B2845",
          600: "#162039",
          700: "#10182C",
          800: "#0B1020",
          900: "#060A14",
        },
        confirm: {
          50:  "#ECF9EE",
          100: "#CFF0D4",
          300: "#6FCF7D",
          500: "#2E933C",
          700: "#1F6B2A",
        },
        pending: {
          50:  "#FFF8EC",
          100: "#FFEDCB",
          300: "#F3C66B",
          500: "#E8A317",
          700: "#A8750A",
        },
        reject: {
          50:  "#FDECEC",
          100: "#F8CDCD",
          300: "#E48282",
          500: "#A4161A",
          700: "#6C0F12",
        },
        abnormal: {
          50:  "#F4ECFA",
          100: "#E3CFF4",
          300: "#B989E0",
          500: "#7B2CBF",
          700: "#521A85",
        },
        ink: {
          50:  "#F9FAFB",
          100: "#F4F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          500: "#6B7280",
          700: "#374151",
          900: "#111827",
        },
      },
      fontFamily: {
        song: ['"Noto Serif SC"', '"Source Han Serif SC"', '"SimSun"', "serif"],
        sans: ['"Noto Sans SC"', '"Source Han Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(27,40,69,.06), 0 1px 3px 0 rgba(27,40,69,.08)",
        press: "inset 0 2px 4px 0 rgba(27,40,69,.12)",
        stripe: "inset 4px 0 0 0 #D7263D",
      },
      backgroundImage: {
        "noise-light":
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.7 0 0 0 0 0.72 0 0 0 0 0.78 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        "stripe-red":
          "repeating-linear-gradient(-45deg,transparent,transparent 8px,rgba(215,38,61,.08) 8px,rgba(215,38,61,.08) 16px)",
        "navy-grad":
          "linear-gradient(135deg,#1B2845 0%,#162039 60%,#0B1020 100%)",
      },
    },
  },
  plugins: [],
};
