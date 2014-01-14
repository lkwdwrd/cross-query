/*! Cross Query - v0.0.8
 * 
 * Copyright (c) 2014; * Licensed GPLv2+ */
// Cross Query iframe messaging system client.
window.xq = ( function( window, document, undefined ) {
	'use strict';
	// Setup vars
	var jQuery, Deferred = window.Deferred || {}, XQs = {}, servers = {},
		iframeDefaults = { width: '0', height: '0', frameBorder: '0', style: { display: 'none' } };

	/**
	 * Support jQuery and simply-deferred
	 * @see https://github.com/sudhirj/simply-deferred
	 */
	jQuery = window.jQuery || {};
	jQuery.Deferred = jQuery.Deferred || Deferred;

	/**
	 * Sets up a query object for making queries to the frame URL.
	 *
	 * Accepts a url string, or iframe object.
	 * 
	 * @param  {string} url The URL of the server site we need to make queries of.
	 * @return {object}     An object containing the methods needed to query the requested frame.
	 */
	function setup( url, args ) {
		// Define vars and context object.
		var bits,
		xqObject = {
			requests: {},
			timeout: {},
			queue: [],
			delay: 5000,
			paused: false
		};
		// Make sure args is not undefined.
		args = args || {};
		
		// If a custom timout was sent, use it
		if ( 'number' === typeof( args.timeout ) && ! isNaN( args.timeout ) ) {
			xqObject.delay = parseInt( args.timeout, 10 );
			delete args.timeout;
		}
		// Set up initial iframe, accepting a passed iframe as well as creating one.
		if ( 'object' === typeof url && 'IFRAME' === url.nodeName ) {
			xqObject.frameRef = url;
			url = xqObject.frameRef.src;
		}
		// Check to see if we already have this object.
		if ( XQs[ url ] ) {
			return XQs[ url ].publicObj;
		}
		// Parse the domain of the passed URL
		bits = url.match( /^(https?:\/\/[^\/]*)(.*)?/ );
		xqObject.origin = bits[1];
		xqObject.path = bits[2];
		xqObject.url = url;
		// if this server is unknown, try to request an init ping. Otherwise, set up server as needed.
		// Note this could throw a postMessage error, but will not affect operations.
		if ( xqObject.frameRef && ! servers[ url ] ) {
			xqObject.frameRef.contentWindow.postMessage( '{ "action": "ping" }', xqObject.origin );
		} else if ( ! xqObject.frameRef ) {
			getFrame.call( xqObject, args );
		}
		// Expose some helper methods in the public object.
		xqObject.publicObj = {
			query:   _bind( xqObject, query ),
			get:     _bind( xqObject, getFrame ),
			pause:   _bind( xqObject, pause ),
			play:    _bind( xqObject, play ),
			refresh: _bind( xqObject, refresh )
		};
		// Save the context object by URL.
		XQs[ xqObject.url ] = xqObject;
		// Return the public object.
		return xqObject.publicObj;
	}
	/**
	 * If the frame is cached, returns it, otherwise, creates the frame and attaches it.
	 * 
	 * @param  {object}    args These are properties of the frame. Any missing defaults will be added.
	 * @return {DOMObject}      The iframe dom node created.
	 */
	function getFrame( args ) {
		if ( undefined === this.frameRef || this.frameRef.closed ) {
			args = args || {};
			if ( true === args.window ) {
				this.openWin = _getWindow( args );
			}
			if ( undefined !== this.openWin ) {
				this.openWin.call( this );
			} else {
				this.frameRef = _getIframe( args, this.origin + this.path );
			}
		}
		return this.frameRef;
	}
	/**
	 * Handles creating and attaching a new iframe to the DOM per the passed args.
	 * 
	 * @param  {object}    args The arguments for creating this new iframe DOM node.
	 * @return {DOMObject}      The DOM node reference to the created iframe.
	 */
	function _getIframe( args, url ) {
		var frame;
		// Set up iframe
		frame = document.createElement( 'iframe' );
		frame = _parseArgs( frame, _parseArgs( args, iframeDefaults ), true );
		// Explicitly set the source.
		frame.src = url;
		document.body.appendChild( frame );
		// Return the reference.
		return frame;
	}
	/**
	 * Creates a method for opening a new window and setting it's reference to the this.frameRef.
	 * 
	 * @param  {object}   args The argument object. .attrs should be a window string.
	 * @return {function}      A function that will open the new window per the argument attrs.
	 */
	function _getWindow( args ) {
		return function getWindow() {
			this.frameRef = window.open( this.url, '', args.attrs );
		};
	}
	/**
	 * Toggles the queue to a paused state. Requests will be queued, not fired when made.
	 * 
	 * @return {void}
	 */
	function pause() {
		this.paused = true;
	}
	/**
	 * Restarts a paused frame and if initialized, fires all queued requests.
	 * 
	 * @return {void}
	 */
	function play() {
		this.paused = false;
		fireQueue.call( this );
	}
	/**
	 * If the iframe source is correct, allows requests to be made.
	 * 
	 * @return {void}
	 */
	function triggerReady( server ) {
		var context, initialized;
		// Make sure we have the server argument.
		if ( 'string' !== typeof server ) {
			return;
		}
		initialized = servers[ server ];
		context = XQs[ server ];
		servers[ server ] = true;

		if ( context && ! initialized ) {
			fireQueue.call( context );
		}
	}
	/**
	 * Fires on frame unload and sets initialized to false.
	 * 
	 * @return {void}
	 */
	function triggerUnready( server ) {
		if ( 'string' !== typeof server ) {
			return;
		}
		servers[ server ] = false;
	}
	/**
	 * Refreshes the frame to the original source so that requests can be made of it.
	 *
	 * @return {void}
	 */
	function refresh() {
		var frame = getFrame.call( this );
		// Accessible way to check if this is a window object or iframe.
		if ( undefined === frame.closed ) {
			frame.src = this.url;
		} else {
			frame.location = this.url;
		}
	}
	/**
	 * If the frame is not initialized, or is paused this fires all requests in the queue.
	 * 
	 * @return {void}
	 */
	function fireQueue() {
		if ( servers[ this.origin + this.path ] && ! this.paused ) {
			var item = this.queue.shift();
			while( item ) {
				sendMessage.call( this, item.key, item.timeout );
				item = this.queue.shift();
			}
		}
	}
	/**
	 * Handles recieiving a postMessage request.
	 *
	 * If the origin matches and the required data is present, this resolves the Deferred object
	 * for this request according to the response and clears the timeout for the request.
	 * 
	 * @param  {event}  event The event object for this postMessage containing the data.
	 * @return {void}
	 */
	function recieveMessage( event ) {
		var response, context, method;
		// Make sure the data key exists.
		if ( ! event.data ) {
			return;
		}
		// Try to decode the response.
		try {
			response = JSON.parse( event.data );
		} catch ( e ) {
			return;
		}
		// See if this is an init or de-init call
		if ( 'xq-init' === response.init ) {
			triggerReady( response.server );
		} else if ( 'xq-de-init' === response.init ) {
			triggerUnready( response.server );
		}
		// Make sure we have the required response keys.
		if ( ! response.url || ! response.key || ! response.data ) {
			return;
		}
		// Set context and method.
		context = XQs[ response.url ];
		if ( 'notify' === response.success ){
			method = 'notifyWith';
		} else {
			method = ( !! response.success ) ? 'resolveWith' : 'rejectWith';
		}
		// Make sure the context object and request objects exist.
		if ( ! context || ! context.requests[ response.key ] ) {
			return;
		}
		// Cancel the timeout and resolve the deferred object according to the response.
		window.clearTimeout( context.timeout[ response.key ] );
		context.requests[ response.key][ method ]( getFrame.call( context ), [ response.data ] );
	}
	/**
	 * Makes the actual postMessage request to the frame and sets up the timeout.
	 * 
	 * @param  {string} message The JSON stringified reqeust object.
	 * @return {void}
	 */
	function sendMessage( message, timeout ) {
		// Get the frame and actual window reference.
		var frame = getFrame.call( this );
		frame = ( undefined === frame.closed ) ? frame.contentWindow : frame;
		// Set timeout value and ensure integer value.
		timeout = ( 'number' === typeof timeout && ! isNaN( timeout ) ) ? parseInt( timeout, 10 ) : this.delay;
		// Determine if we can and should post a message.
		if ( frame.postMessage && servers[ this.url ] ) {
			frame.postMessage( message, this.origin );
			if ( 0 < timeout ) {
				this.timeout[ message ] = window.setTimeout( queryTimeout( this, message ), timeout );
			}
		} else {
			this.queue.unshift( { key: message, timeout: timeout } );
			refresh.call( this );
		}
	}
	/**
	 * Handles the creation of timeout callback functions for specific requests.
	 * 
	 * @param  {string}   id The JSON stringigied request object used as this requests key.
	 * @return {function}    The callback function for this specific request with ID in the closure.
	 */
	function queryTimeout( context, id ) {
		return function timeout() {
			context.requests[ id ].rejectWith( getFrame.call( context ), [ { error: 'The request timed out' } ] );
		};
	}
	/**
	 * Handles creating a query of this frame.
	 *
	 * If the frame is paused or not initialized, queues the request until it is unpaused or has
	 * actually finished initializing.
	 * 
	 * @param  {object}  args  The arguments to send with this request
	 * @param  {boolean} cache If false, this request will not use a cached response.
	 * @return {object}        The promise object for this requests for attaching callbacks.
	 */
	function query( args, options ) {
		var key, callbacks, frame;
		// validate input, pass callbacks, and create our cache key.
		if ( 'object' !== typeof args ) {
			return false;
		}
		key = JSON.stringify( args );
		options = options || {};
		// If we have been asked to use the cache, send back cached data as availalble.
		if ( true === options.cache && undefined !== this.requests[ key ] ) {
			return this.requests[ key ].promise();
		} else {
			this.requests[ key ] = jQuery.Deferred();
		}
		// If we are paused or not loaded yet, send this requests to the queue, else, send it.
		if ( servers[ this.url ] && ! this.paused ) {
			sendMessage.call( this, key, options.timeout );
		} else {
			this.queue.push( { key: key, timeout: options.timeout } );
			frame = getFrame.call( this );
			if ( undefined === frame.closed && this.url !== frame.src ) {
				refresh.call( this );
			}
		}

		return this.requests[ key ].promise();
	}
	/**
	 * Sets up the arguments objects. Uses object values unless overwrite is true.
	 *
	 * @param  {object}  object    The object to which arguments should be added.
	 * @param  {object}  args      The set of passed arguments for the iframe object properties.
	 * @param  {boolean} overwrite Whether to overwrite object values with args values.
	 * @return {object}            The object with added arguments.
	 */
	function _parseArgs( object, args, overwrite ) {
		var key;
		object = object || {};
		for ( key in args ) {
			if ( 'object' === typeof args[ key ] ) {
				_parseArgs( object[ key ], args[ key ] );
			} else if ( overwrite || ! object[ key ] ) {
				object[ key ] = args[ key ];
			}
		}
		return object;
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
	// Add listeners according to browser capability
	if ( window.addEventListener ) {
		window.addEventListener( 'message', recieveMessage, false );
	} else if ( window.attachEvent ) {
		window.attachEvent( 'onmessage', recieveMessage );
	}
	// Return our setup function
	return setup;
})( window, document );