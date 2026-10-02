/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#05240f',
        aqua: '#25D366',
        whatsapp: '#25D366'
      },
      boxShadow: {
        glass: '0 24px 80px rgba(0,0,0,.34)'
      }
    }
  },
  plugins: []
};
