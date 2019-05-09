
//Webpack distribution configuration
//This file is set up for serving the distribution version. It will be compiled to dist/ by default

'use strict';

var path = require('path');
var webpack = require('webpack');

module.exports =
{
    mode: 'production',
    entry: 
    [
        './src/index.js' //File to convert
    ],
    output: 
    {
        filename: 'main.js', //Name of converted index.js
        publicPath: '/', //Output location relative to server
        path: path.join(__dirname, "dist"), //Output location relative to computer
    },
    devtool: false,
    optimization: 
    {
        minimize: true,
    },
    stats:
    {
        colors: true,
        reasons: false
    },
    node:
    {
        fs: 'empty'
    },
    plugins:
    [
        new webpack.optimize.AggressiveMergingPlugin()
    ],
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
                    { loader: 'css-loader' },
                    { 
                        loader: 'sass-loader',
                        options:
                        {
                            indentedSyntax: true,
                            outputStyle: 'expanded'
                        } 
                    }
                ],
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
                ],
            }
        ]
    }
};