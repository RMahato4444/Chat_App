/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#07111f',
        aqua: '#3b82f6',
        whatsapp: '#3b82f6',
        bluechat: '#3b82f6'
      },
      boxShadow: {
        glass: '0 24px 80px rgba(0,0,0,.34)'
      }
    }
  },
  plugins: []
};
