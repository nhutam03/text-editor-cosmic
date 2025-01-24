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
    themes: [
      {
        light: {
          ...require("daisyui/src/theming/themes")["[data-theme=light]"],
          "primary": "#3b82f6", // Màu primary cho light mode (ví dụ: xanh dương)
          "secondary": "#f6d860",
          "accent": "#37cdbe",
          "neutral": "#3d4451",
          "base-100": "#ffffff", // Màu nền cho light mode
          "base-200": "#f2f2f2", // Màu nền thứ cấp
          "base-300": "#e6e6e6",
          "base-content": "#1f2937", // Màu chữ cho light mode
        },
      },
      {
        dark: {
          ...require("daisyui/src/theming/themes")["[data-theme=dark]"],
          "primary": "#38bdf8", // Màu primary cho dark mode (ví dụ: xanh nhạt hơn)
          "secondary": "#f0abfc",
          "accent": "#1dcdbc",
          "neutral": "#272a37",
          "base-100": "#111827", // Màu nền cho dark mode
          "base-200": "#1f2937",
          "base-300": "#374151",
          "base-content": "#f9fafb", // Màu chữ cho dark mode
        },
      },
    ],
  },
}
