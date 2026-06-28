/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Surface tiers from DESIGN.md
        "background":                "#121212",
        "surface":                   "#121212",
        "surface-dim":               "#131313",
        "surface-container-lowest":  "#0e0e0e",
        "surface-container-low":     "#1E1E1E",
        "surface-container":         "#2C2C2E",
        "surface-container-high":    "#3A3A3C",
        "surface-container-highest": "#48484A",
        "surface-bright":            "#393939",
        "surface-variant":           "#353535",
        // Text
        "on-surface":         "#FFFFFF",
        "on-surface-variant": "#AEAEB2",
        "on-background":      "#e5e2e1",
        // Primary (macOS Royal Blue)
        "primary":            "#0A84FF",
        "on-primary":         "#FFFFFF",
        "primary-container":  "#0A84FF",
        // Secondary
        "secondary":          "#8E8E93",
        "secondary-container":"#474649",
        // Warning/Amber
        "tertiary":   "#FF9500",
        "warning":    "#FF9500",
        // Error
        "error":      "#FF453A",
        // Borders
        "outline":         "#3A3A3C",
        "outline-variant": "#48484A",
      },
      borderRadius: {
        DEFAULT: "6px",
        sm:      "4px",
        lg:      "10px",
        xl:      "12px",
        "2xl":   "16px",
        full:    "9999px",
      },
      spacing: {
        xs:   "4px",
        sm:   "8px",
        md:   "16px",
        lg:   "24px",
        xl:   "32px",
        gutter: "16px",
        "margin-desktop": "24px",
        "margin-mobile":  "16px",
      },
      fontFamily: {
        sans:    ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono:    ["JetBrains Mono", "SF Mono", "Fira Code", "monospace"],
        "body-md":      ["Inter", "sans-serif"],
        "body-sm":      ["Inter", "sans-serif"],
        "headline-lg":  ["Inter", "sans-serif"],
        "headline-md":  ["Inter", "sans-serif"],
        "headline-sm":  ["Inter", "sans-serif"],
        "code-sm":      ["JetBrains Mono", "monospace"],
        "label-caps":   ["Inter", "sans-serif"],
      },
      fontSize: {
        "body-md":     ["14px", { lineHeight: "24px", letterSpacing: "0",       fontWeight: "400" }],
        "body-sm":     ["13px", { lineHeight: "20px", letterSpacing: "0",       fontWeight: "400" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-sm": ["18px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "500" }],
        "code-sm":     ["13px", { lineHeight: "20px", letterSpacing: "0",       fontWeight: "450" }],
        "label-caps":  ["11px", { lineHeight: "16px", letterSpacing: "0.05em",  fontWeight: "600" }],
      },
      animation: {
        "status-pulse": "pulse-blue 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "cursor-blink": "blink 1s step-end infinite",
        "fade-in":      "fade-in 0.3s ease-out",
        "slide-up":     "slide-up 0.4s ease-out",
      },
      keyframes: {
        "pulse-blue": {
          "0%, 100%": { opacity: "1",   transform: "scale(1)"   },
          "50%":      { opacity: "0.5", transform: "scale(1.2)" },
        },
        blink: {
          "50%": { opacity: "0" },
        },
        "fade-in": {
          "from": { opacity: "0" },
          "to":   { opacity: "1" },
        },
        "slide-up": {
          "from": { opacity: "0", transform: "translateY(8px)" },
          "to":   { opacity: "1", transform: "translateY(0)"   },
        },
      },
      backdropBlur: {
        xs: "4px",
      },
    },
  },
  plugins: [],
}
