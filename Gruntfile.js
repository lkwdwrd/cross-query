module.exports = function( grunt ) {

	// Project configuration
	grunt.initConfig( {
		pkg:    grunt.file.readJSON( 'package.json' ),
		jshint: {
			all: [
				'Gruntfile.js',
				'src/*.js',
			],
			options: {
				curly:     true,
				eqeqeq:    true,
				immed:     true,
				latedef:   true,
				newcap:    true,
				noarg:     true,
				sub:       true,
				undef:     true,
				boss:      true,
				eqnull:    true,
				validthis: true,
				globals: {
					window:   true,
					document: true,
					console:  true
				}
			}
		},
		concat: {
			options: {
				stripBanners: true,
				banner: '/*! <%= pkg.title %> - v<%= pkg.version %>\n' +
					' * <%= pkg.homepage %>\n' +
					' * Copyright (c) <%= grunt.template.today("yyyy") %>;' +
					' * Licensed GPLv2+' +
					' */\n'
			},
			server: {
				src: ['src/xqServer.js'],
				dest: 'build/xqServer.js'
			},
			client: {
				src: ['src/xqClient.js'],
				dest: 'build/xqClient.js'
			},
			proxyClient: {
				src: ['src/proxy/xqProxyClient.js'],
				dest: 'build/proxy/xqProxyClient.js'
			},
			proxyServer: {
				src: ['src/proxy/xqProxyServer.js'],
				dest: 'build/proxy/xqProxyServer.js'
			},
		},
		uglify: {
			all: {
				files: {
					'build/xqServer.js': ['build/xqServer.min.js'],
					'build/xqClient.js': ['build/xqClient.min.js'],
					'build/proxy/xqProxyServer.js': ['build/proxy/xqProxyServer.min.js'],
					'build/proxy/xqProxyClient.js': ['build/proxy/xqProxyClient.min.js']
				},
				options: {
					banner: '/*! <%= pkg.title %> - v<%= pkg.version %>\n' +
						' * <%= pkg.homepage %>\n' +
						' * Copyright (c) <%= grunt.template.today("yyyy") %>;' +
						' * Licensed GPLv2+' +
						' */\n',
					mangle: {
						except: ['jQuery']
					}
				}
			}
		},
		watch:  {
			scripts: {
				files: ['src/*.js', 'Gruntfile.js'],
				tasks: ['jshint', 'concat', 'uglify'],
				options: {
					debounceDelay: 500
				}
			}
		}
	} );
	
	// Load other tasks
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-watch');
	
	// Default task.
	grunt.registerTask( 'default', ['jshint', 'concat', 'uglify'] );

	grunt.util.linefeed = '\n';
};