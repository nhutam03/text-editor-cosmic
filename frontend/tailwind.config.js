/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',        // File HTML chính
    './src/**/*.js',       // Tất cả file JS trong thư mục src
    './src/**/*.html',     // Tất cả file HTML trong thư mục src (nếu có)
    './styles.css',        // File CSS chứa các directive Tailwind
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
}

