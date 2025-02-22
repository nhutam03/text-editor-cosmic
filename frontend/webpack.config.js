const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/index.js', // Điểm vào là file index.js của bạn
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
            {
                test: /\.css$/, // Xử lý các file CSS, bao gồm Tailwind
                use: [
                    'style-loader', // Inject CSS vào DOM
                    'css-loader',   // Xử lý import CSS
                    'postcss-loader', // Xử lý Tailwind qua PostCSS
                ],
            },
        ],
    },
    resolve: {
        extensions: ['.js'], // Tự động resolve các file .js
        fallback: {
            "path": require.resolve("path-browserify")
        }
    },
    plugins: [
        // Có thể thêm plugin cho Monaco Editor nếu cần, nhưng thường không cần nếu dùng ESM
    ],
    target: 'electron-renderer', // Đảm bảo nhắm đến renderer process của Electron
};