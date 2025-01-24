module.exports = {
  content: [
    "./*.html", // Nếu file HTML của bạn nằm ở root
    "./*.js", // Nếu bạn sử dụng file JavaScript cho giao diện
    "./renderer/**/*.{html,js}", // Nếu bạn sử dụng file JavaScript cho
  ],
  purge: [],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: ["light", "dark"], // Bạn có thể định nghĩa các theme tại đây
  },
}
