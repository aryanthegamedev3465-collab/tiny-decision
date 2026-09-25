/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Grok Deep Space Canvas
        bg: {
          base: "#060709",
          surface: "#0c0e14",
          elevated: "#121520",
          overlay: "#181c2b",
          card: "rgba(16, 20, 31, 0.75)",
        },
        // Cyber & Neon Grok Accents
        grok: {
          cyan: "#00f0ff",
          emerald: "#00ff88",
          amber: "#ffb703",
          crimson: "#ff0055",
          purple: "#9d4edd",
          blue: "#3a86ff",
        },
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          subtle: "rgba(255, 255, 255, 0.05)",
          strong: "rgba(255, 255, 255, 0.15)",
          glow: "rgba(0, 240, 255, 0.3)",
        },
        text: {
          primary: "#f8fafc",
          secondary: "#94a3b8",
          muted: "#64748b",
          disabled: "#334155",
        },
        confidence: {
          high: "#00ff88",
          highDim: "#00cc6a",
          mid: "#ffb703",
          midDim: "#e09f00",
          low: "#ff0055",
          lowDim: "#cc0044",
        },
        accent: {
          DEFAULT: "#00ff88",
          cyan: "#00f0ff",
          purple: "#9d4edd",
          amber: "#ffb703",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        "glow-cyan": "0 0 20px rgba(0, 240, 255, 0.25)",
        "glow-emerald": "0 0 20px rgba(0, 255, 136, 0.25)",
        "glow-purple": "0 0 20px rgba(157, 78, 221, 0.25)",
        "glow-amber": "0 0 20px rgba(255, 183, 3, 0.25)",
        "glow-crimson": "0 0 20px rgba(255, 0, 85, 0.25)",
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
      animation: {
        "pulse-fast": "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "gradient-x": "gradientX 8s ease infinite",
      },
      keyframes: {
        glowPulse: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        gradientX: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
};
