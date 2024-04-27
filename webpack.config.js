const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
module.exports = {
  entry: "./src/main.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "index.html",//打包出的文件名
      template: './index.html',
      hash: true,
    }),
    new CleanWebpackPlugin()
  ],
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react',
            ],
          },
        },
      },
    ]
  },
  // 热部署（热更新）的配置
  devServer: {
    // 如果需要的资源没有在webpack里面加载到，会去contentBase指定的文件夹里面寻找
    // contentBase: "./public",
    hot: true,
    port: 3000,
    static: {
      directory: path.join(__dirname, 'src'),
      watch: true,
    }
  },
  // 打包的是node环境 还是 web 环境
  target: "web",
  mode: "development"
}