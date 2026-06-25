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
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: [
          "var(--font-display)",
          "var(--font-sans)",
          "system-ui",
          "sans-serif",
        ],
      },
      letterSpacing: {
        heading: "-0.025em",
        label: "0.07em",
      },
      colors: {
        // All le-* colors reference CSS custom properties so dark/light themes
        // work by swapping the variable values — no class changes needed.
        "le-bg": "rgb(var(--le-bg) / <alpha-value>)",
        "le-surface": "rgb(var(--le-surface) / <alpha-value>)",
        "le-elevated": "rgb(var(--le-elevated) / <alpha-value>)",
        "le-hover": "rgb(var(--le-hover) / <alpha-value>)",
        "le-accent": "rgb(var(--le-accent) / <alpha-value>)",
        // Fixed-alpha convenience alias — used where the opacity never varies.
        "le-accent-soft": "rgb(var(--le-accent) / 0.12)",
        "le-mint": "rgb(var(--le-mint) / <alpha-value>)",
        "le-violet": "rgb(var(--le-violet) / <alpha-value>)",
        "le-green": "rgb(var(--le-green) / <alpha-value>)",
        "le-red": "rgb(var(--le-red) / <alpha-value>)",
        "le-text": "rgb(var(--le-text) / <alpha-value>)",
        "le-text-secondary": "rgb(var(--le-text-secondary) / <alpha-value>)",
        "le-text-hint": "rgb(var(--le-text-hint) / <alpha-value>)",
        // Border colours flip between white-based (dark) and black-based (light).
        "le-border": "rgb(var(--le-border-raw) / 0.07)",
        "le-border-strong": "rgb(var(--le-border-raw) / 0.14)",
      },
      boxShadow: {
        glow: "0 10px 30px -12px rgb(var(--le-accent) / 0.45)",
        "glow-sm": "0 6px 18px -10px rgb(var(--le-accent) / 0.35)",
        card: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -16px rgba(0,0,0,0.7)",
        "card-hover": "0 2px 4px rgba(0,0,0,0.35), 0 12px 32px -12px rgba(0,0,0,0.55)",
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
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
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
        "fade-in-up": "fade-in-up 0.35s ease-out",
        "fade-in-up-slow": "fade-in-up 0.55s cubic-bezier(0.16,1,0.3,1)",
        "scale-in": "scale-in 0.35s cubic-bezier(0.16,1,0.3,1)",
        float: "float 5s ease-in-out infinite",
        "fade-out": "fade-out 0.4s ease-out forwards",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "progress-fill": "progress-fill 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
