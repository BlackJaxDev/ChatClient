
//Webpack development server configuration

'use strict';

var path = require('path');
var webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = 
{
    mode: 'development',
    entry: 
    [
        'webpack/hot/only-dev-server', //Webpack server
        './src/index.js' //File to convert
    ],
    output: 
    {
        filename: 'main.js', //Name of converted index.js
        publicPath: '/', //Output location relative to server
        path: path.join(__dirname, "dev"), //Output location relative to computer
    },
    cache: false,
    devtool: false,
    optimization: 
    {
        minimize: false,
    },
    stats: 'minimal',
    devServer: 
    {
        hot:                true,
        port:               3000,
        historyApiFallback: true,
        inline:             true,
        progress:           true,
        contentBase:        __dirname,
    },
    node:
    {
        fs: 'empty',
    },
    plugins:
    [
        new webpack.HotModuleReplacementPlugin(),
        new webpack.LoaderOptionsPlugin({ debug: true }),
        new HtmlWebpackPlugin(
        {
            inject: true,
            template: "public/index.web.html",
            filename: "index.html"
        }),
    ],
    externals: ['axios'],
    module:
    {
        rules: 
        [
            {
                test: /\.html$/,
                use: 
                [
                    {
                        loader: "html-loader"
                    }
                ]
            },
            {
                test: /\.js[x]?$/,
                exclude: /node_modules/,
                use: 
                [
                    { loader: 'react-hot-loader/webpack' },
                    {
                        loader: 'babel-loader',
                        options:
                        {
                            babelrc: false,
                            presets:
                            [
                                "@babel/preset-react", 
                                "@babel/preset-env"
                            ],
                            "plugins": 
                            [
                                ["babel-plugin-dotenv", { "replacedModuleName": "babel-dotenv"}],
                                ["@babel/plugin-proposal-class-properties", { "loose": true }],
                                ["react-hot-loader/babel", {}],
                                ["@babel/plugin-transform-runtime"]
                            ]
                        } 
                    }
                ],
            },
            {
                test: /\.sass/,
                use: 
                [
                    { loader: 'style-loader' },
                    { 
                        loader: 'css-loader',
                        options: 
                        {
                            modules: true,
                            importLoaders: 1,
                            localIdentName: "[name]_[local]_[hash:base64]",
                            sourceMap: true,
                            minimize: true
                        }
                    },
                    { 
                        loader: 'sass-loader',
                        options:
                        {
                            indentedSyntax: true,
                            outputStyle: 'expanded'
                        }
                    }
                ]
            },
            {
                test: /\.css$/,
                use: 
                [
                    { loader: 'style-loader' },
                    { loader: 'css-loader' }
                ]
            },
            {
                test: /\.(png|jpg)$/,
                use: 
                [
                    { 
                        loader: 'url-loader',
                        options:
                        {
                            limit: 8192,
                        } 
                    },
                ]
            }
        ]
    }
};