import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        court: "#0f6f5f",
        "court-dark": "#07150d",
        "court-soft": "#e7f4ed",
        limeball: "#9cff1a",
        ink: "#10231c",
        mist: "#f5f7f1",
        porcelain: "#fbfcf8",
        line: "#dfe6d8"
      },
      boxShadow: {
        premium: "0 18px 50px rgba(7, 21, 13, 0.08)",
        "premium-sm": "0 10px 28px rgba(7, 21, 13, 0.06)"
      },
      borderRadius: {
        xl: "0.875rem"
      }
    }
  },
  plugins: []
};

export default config;
