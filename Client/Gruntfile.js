'use strict';

var path = require('path');
var serveStatic = require('serve-static');

var mountFolder = function(dir)
{
    return serveStatic(path.resolve(dir));
};

var webpackDistConfig = require('./webpack.dist.config.js');
var webpackDevConfig = require('./webpack.dev.config.js');

module.exports = function(grunt)
{
    // Let *load-grunt-tasks* require everything
    require('load-grunt-tasks')(grunt);

    grunt.loadNpmTasks('grunt-webpack');
    grunt.loadNpmTasks('grunt-keepalive');

    // Read configuration from package.json
    var pkgConfig = grunt.file.readJSON('package.json');

    grunt.initConfig(
    {
        'pkg': pkgConfig,
        'webpack': 
        {
            options: webpackDistConfig,
            dist: 
            {
                cache: false
            },
        },
        'webpack-dev-server':
        {
            options:
            {
                webpack: webpackDevConfig,
                hot:                true,
                port:               3000,
                historyApiFallback: true,
                inline:             true,
                progress:           true,
                contentBase:        __dirname,
            },
            keepalive: true,
        },
        'connect':
        {
            options:
            {
                port: 3000
            },
            dist: 
            {
                options:
                {
                    keepalive: true,
                    middleware: function()
                    {
                        return [mountFolder(pkgConfig.dist)];
                    }
                }
            }
        },
        'open':
        {
            options:
            {
                delay: 500
            },
            dev:
            {
                path: 'http://localhost:<%= connect.options.port %>/webpack-dev-server/'
            },
            dist:
            {
                path: 'http://localhost:<%= connect.options.port %>/'
            }
        },
        'karma':
        {
            unit:
            {
                configFile: 'karma.conf.js'
            }
        },
        'copy':
        {
            dist:
            {
                files: 
                [
                    {
                        flatten: true,
                        src: ['<%= pkg.src %>/index.web.html'],
                        dest: '<%= pkg.dist %>/index.html'
                    },
                    {
                        flatten: true,
                        src: ['<%= pkg.src %>/favicon.ico'],
                        dest: '<%= pkg.dist %>/favicon.ico'
                    }
                ]
            }
        },
        'clean':
        {
            dist:
            {
                options:
                {
                    force: true
                },
                files: 
                [
                    {
                        dot: true,
                        src: ['<%= pkg.dist %>']
                    }
                ]
            }
        },
        'watch': 
        {
            options:
            {
                livereload: true
            },
            build:
            {
                files: 'src/**/*.js',
                tasks: ['webpack']
            }
        },
        'exec':
        {
            launch_nw: '/Applications/nwjs.app/Contents/MacOS/nwjs .',
            launch_electron: 'electron electron.js'
        },
        'concurrent':
        {
            nw:
            {
                tasks: ['watch', 'exec:launch_nw'],
                options:
                {
                    logConcurrentOutput: true
                }
            },
            electron:
            {
                tasks: ['watch', 'exec:launch_electron'],
                options:
                {
                    logConcurrentOutput: true
                }
            }
        }
    });
    grunt.registerTask('serve-web', function(target) 
    {
        if (target === 'dist')
        {
            return grunt.task.run(['build', 'open:dist', 'connect:dist']);
        }
        grunt.task.run(['open:dev', 'webpack-dev-server', 'keepalive']);
    });
    grunt.registerTask('serve-nw', function() 
    {
        grunt.task.run(['concurrent:nw']);
    });
    grunt.registerTask('serve-electron', function()
    {
        grunt.task.run(['concurrent:electron']);
    });
    grunt.registerTask('test', ['karma']);
    grunt.registerTask('build', ['clean', 'copy', 'webpack']);
    grunt.registerTask('default', []);
};