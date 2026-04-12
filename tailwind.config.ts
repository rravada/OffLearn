import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        heading: "-0.02em",
        label: "0.06em",
      },
      colors: {
        "le-bg": "#0D1117",
        "le-surface": "#161B27",
        "le-elevated": "#1E2535",
        "le-hover": "#252D40",
        "le-accent": "#F0A500",
        "le-accent-soft": "rgba(240,165,0,0.12)",
        "le-green": "#2ECC71",
        "le-red": "#E74C3C",
        "le-text": "#F0F2F5",
        "le-text-secondary": "#8B92A5",
        "le-text-hint": "#4A5168",
        "le-border": "rgba(255,255,255,0.07)",
        "le-border-strong": "rgba(255,255,255,0.14)",
      },
      keyframes: {
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "progress-fill": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-in-up": "fade-in-up 0.3s ease-out",
        "fade-out": "fade-out 0.4s ease-out forwards",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "progress-fill": "progress-fill 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
