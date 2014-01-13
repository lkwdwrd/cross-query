(function( window, document, undefined ){
	'use strict';
	// Set up caches and stash a reference to the original method.
	var xquid = -1, proxies = {}, xqMain = window.xq;
	/**
	 * Overloads the main XQ method with a wrapper to account for IE8-9 cross window postMessage support.
	 *
	 * Accepts a url string, or iframe object.
	 * 
	 * @param  {string} url The URL of the server site we need to make queries of.
	 * @return {object}     An object containing the methods needed to query the requested frame.
	 */
	function xqProxy( url, args ) {
		args = args || {};
		// If this is not a window XQ, don't change things.
		if ( 'string' !== typeof url || true !== args.window ) {
			return xqMain( url, args );
		}
		// If we already have a proxy for this window, return it.
		if ( proxies[ url ] ) {
			return proxies[ url ].publicObj;
		}
		// Create an open method, proxy iframe, and window to use for these requests.
		proxies[ url ] = { url: url };
		proxies[ url ].messageKey = _xquid() + _xquid();
		proxies[ url ].openWindow = _getWindow( url, proxies[ url ].messageKey, args.attrs );
		proxies[ url ].xqObject = xqMain( url );
		proxies[ url ].openWindow();
		// Activate the iframe as soon as it's ready.
		xqActivate.call( proxies[ url ] );
		// Create the public object and return it.
		proxies[ url ].publicObj =  {
			query:   _bind( proxies[ url ], query ),
			get:     _bind( proxies[ url ], getFrame ),
			refresh: _bind( proxies[ url ], refresh ),
			pause:   proxies[ url ].xqObject.pause,
			start:   proxies[ url ].xqObject.play
		};
		return proxies[ url ].publicObj;
	}
	/**
	 * Wraps the query method so that we can make sure the window is open.
	 * 
	 * @param  {object}  args  The arguments to send with this request
	 * @param  {boolean} cache If false, this request will not use a cached response.
	 * @return {object}        The promise object for this requests for attaching callbacks.
	 */
	function query( args, options ) {
		if ( this.win.closed ) {
			this.openWindow();
		}
		if ( ! this.active ) {
			xqActivate.call( this );
		}
		return this.xqObject.query({
			action: 'proxyCall',
			data: args
		}, options );
	}
	/**
	 * Overloads the get method so that we can return the window object, not the proxy frame.
	 * 
	 * @param  {object}    args These are properties of the frame. Any missing defaults will be added.
	 * @return {DOMObject}      The iframe dom node created.
	 */
	function getFrame( args ) {
		return this.win;
	}
	/**
	 * Refreshes window and frame to the original source so that requests can be made of it.
	 *
	 * @return {void}
	 */
	function refresh() {
		this.win.location = this.url;
		this.xqObject.refresh();
	}
	/**
	 * Sends an uncached request to the iframe to give it the window's message key.
	 *
	 * If a request is made and the iframe detects that the window is no longer ready, it will
	 * send back this request and run the xqDeactivate script. The next query will cause this
	 * to be run again to try and reactivate the window.
	 * 
	 * @return {void}
	 */
	function xqActivate() {
		this.xqObject.query({
			action: 'xqProxyActivate',
			data: this.messageKey
		}, {
			cache: false,
			timeoout: -1
		})
		.always( _bind( this, xqDeactivate ) );
		this.active = true;
	}
	/**
	 * Sets the status of this window to false. Causes reactivation on the next query.
	 * 
	 * @return {void}
	 */
	function xqDeactivate() {
		this.active = false;
	}
	/**
	 * Creates a method for opening a new window and setting it's reference to the this.frameRef.
	 * 
	 * @param  {object}   args The argument object. .attrs should be a window string.
	 * @return {function}      A function that will open the new window per the argument attrs.
	 */
	function _getWindow( url, name, attrs ) {
		return function getWindow() {
			this.win = window.open( url, name, attrs );
		};
	}
	/**
	 * Binds a method to a specific context for exposure
	 *
	 * @param  {object}    context The context to bind the method to.
	 * @param  {function}  method  The function which needs to be bound to a specific context.
	 * @return {function}          The bound method. Undefined if incorrect args are passed.
	 */
	function _bind( context, method ) {
		if ( 'object' === typeof context && 'function' === typeof method ) {
			return function boundMethod() {
				return method.apply( context, arguments );
			};
		}
	}
	/**
	 * Creates a Unique ID to be used for this window.
	 *
	 * @return {string} A randomized, yet unique ID to use for this window.
	 */
	function _xquid() {
		xquid++;
		return Math.random().toString(36).substring(7) + xquid;
	}
	// Re-reference the XQ method to our wrapper method.
	window.xq = xqProxy;
})( window, document, undefined );