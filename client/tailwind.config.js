/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#071013',
        aqua: '#25d4b5'
      },
      boxShadow: {
        glass: '0 24px 80px rgba(0,0,0,.36)'
      }
    }
  },
  plugins: []
};
