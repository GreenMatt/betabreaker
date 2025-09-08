/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          purple: '#8A2BE2',
          purpleDark: '#6c21b5'
        },
        base: {
          bg: '#ffffff',
          panel: '#f8f7ff',
          text: '#111827',
          subtext: '#6b7280'
        }
      },
      boxShadow: {
        glow: '0 0 20px rgba(138,43,226,0.5)'
      }
    },
  },
  plugins: [],
}
