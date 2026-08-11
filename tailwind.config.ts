import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17150F",
        paper: "#EFEAE0",
        cypress: "#1F4B47",
        ochre: "#C8843A",
        sand: "#D9CDB5",
        mist: "#E4DED2"
      },
      fontFamily: {
        display: ["var(--font-lora)", "Georgia", "serif"],
        sans: ["var(--font-manrope)", "Arial", "sans-serif"]
      },
      boxShadow: { "soft-ink": "0 18px 60px rgba(23, 21, 15, 0.11)" }
    }
  },
  plugins: []
};
export default config;
