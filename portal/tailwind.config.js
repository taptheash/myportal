/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // The portal's accent color. Every `indigo-*` class in the app now
        // renders as this soft lavender, so the whole accent changes here in
        // one place instead of across hundreds of class names.
        indigo: {
          50: '#f5f3fc',
          100: '#ebe7f9',
          200: '#d8d0f2',
          300: '#bcb0e6',
          400: '#9c8dd7',
          500: '#8070c7',
          600: '#6a5ab4',
          700: '#594a9a',
          800: '#4a3e7d',
          900: '#3d3566',
          950: '#25203f',
        },
      },
    },
  },
  plugins: [],
};
