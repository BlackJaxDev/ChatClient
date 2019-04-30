
//Webpack distribution configuration
//This file is set up for serving the distribution version. It will be compiled to dist/ by default

'use strict';

var path = require('path');
var webpack = require('webpack');

module.exports =
{
    mode: 'production',
    entry: './src/index.js',
    output:
    {
        filename: 'main.js',
        publicPath: '/assets/',
        path: path.resolve(__dirname, 'dist/assets')
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
    plugins:
    [
        new webpack.optimize.AggressiveMergingPlugin()
    ],
    module:
    {
        rules: 
        [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: 
                [
                    { loader: 'babel-loader' }
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