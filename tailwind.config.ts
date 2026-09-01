import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          400: "#38bdf8",
          500: "#0070d2",
          600: "#005fb2",
          700: "#004f94",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  safelist: [
    {
      pattern:
        /bg-(slate|violet|emerald|amber|pink|green|red|blue|brand)-(50|100|200|300|400|500|600|700|800|900)(\/\d+)?/,
      variants: ["dark", "hover", "dark:hover"],
    },
    {
      pattern:
        /text-(slate|violet|emerald|amber|pink|green|red|blue|brand|white)-(50|100|200|300|400|500|600|700|800|900)/,
      variants: ["dark"],
    },
    {
      pattern:
        /border-(slate|violet|emerald|amber|pink|green|red|blue)-(100|200|300|400|500|600|700|800)/,
      variants: ["dark"],
    },
  ],
  plugins: [],
};

export default config;
