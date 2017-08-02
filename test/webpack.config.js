var path = require('path');
module.exports = {
    context: path.resolve(__dirname),
    entry: "./entry.js",
    output: {
        filename: "bundle.js",
        path: path.join(__dirname, 'build')
    },
    module: {
        loaders: [
            {
                test: /\.font\.(js|json)$/,
                loader: ["style-loader","css-loader",{loader: require.resolve("../"), options: {types: 'ttf'}}]
            }, {
                test: /\.(woff|eot|ttf|svg)$/,
                loader: "url-loader"
            }
        ]
    }
};
