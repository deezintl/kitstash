import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0D0D0D",
        surface: "#1A1A1A",
        border: "#2A2A2A",
        accent: "#22C55E",
        warning: "#FACC15",
        danger: "#EF4444",
        "text-primary": "#F5F5F5",
        "text-secondary": "#A3A3A3",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
