/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0B0C10",
        darkPanel: "#1F2833",
        cyberCyan: "#66FCF1",
        cyberTeal: "#45A29E",
        cyberSilver: "#C5C6C7",
        cyberPink: "#FF2E63",
        cyberGreen: "#00E676"
      },
    },
  },
  plugins: [],
}
