/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Premium brand palette (deep governmental navy + royal primary + refined gold)
        brand: {
          navy: '#0B1F3A',      // headings, sidebar, premium depth
          primary: '#1D4ED8',   // royal blue — primary actions
          primaryDeep: '#153AA6',
          gold: '#D9B64A',      // refined gold accent
          goldDeep: '#8C6D1F',
          emerald: '#0F7B4F',
        },
        // Rwanda flag palette — retuned to premium tones, same token names
        rwanda: {
          blue: '#1D4ED8',
          green: '#0F7B4F',
          yellow: '#D9B64A',
        },
      },
      boxShadow: {
        premium: '0 12px 32px -8px rgba(11, 31, 58, 0.18)',
        'premium-sm': '0 4px 14px -4px rgba(11, 31, 58, 0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
