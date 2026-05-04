/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6ff',
          200: '#bdd1ff',
          300: '#92b1ff',
          400: '#6087ff',
          500: '#3b62f5',
          600: '#2542e2',
          700: '#1c33b8',
          800: '#1c2e91',
          900: '#1d2c73',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
