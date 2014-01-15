/*! Cross Query - v0.0.8
 * 
 * Copyright (c) 2014; * Licensed GPLv2+ */
// Cross Query iframe messaging system server.
window.xqServer = ( function( window, document, undefined ) {
	'use strict';
	// Setup vars
	var initialized = false, domains = [], callbacks = {}, shutdown = [],
		initURL = window.location.toString(), initOrigin,
		client = ( ! window.opener ) ? window.parent : window.opener;
	
	/**
	 * Sets up the XQ postMessage handler for the server side.
	 *
	 * When setting up callback functions they should take the passed data as an argument. 
	 * When called it's 'this' context will be set to a helper object. To send back data
	 * use this.sendSuccess( data ); or this.sendFail( data );
	 * 
	 * @param  {object} actions    The list of actions and callback functions for this server.
	 * @param  {array}  domainList An array of domains that this server will accept requests from.
	 * @return {object}            An object containing the servers helper functions.
	 */
	function setup( actions, domainList ) {
		var action;
		// Set up accepted domains.
		if ( domainList instanceof Array ) {
			domains = domainList;
		}
		// Set up callback actions/functions
		for ( action in actions ) {
			if ( 'function' === typeof actions[ action ] ) {
				callbacks[ action ] = actions[ action ];
			}
		}
		// Tell interested parties that we are now ready to accept requests.
		_initPing();
		// Allow dynamic adding and removing of actions, plus shutdown methods.
		return {
			addAction: addAction,
			removeAction: removeAction,
			registerShutdown: registerShutdown
		};
	}
	/**
	 * Handles recieiving a postMessage request.
	 *
	 * If the action in the event data matches a registerred action, that action's callback
	 * function will be invoked with a helper object as it's 'this' context. It will also be
	 * passed the data as a function parameter. When the callback function processes the 
	 * passed data, on success it should call this.sendSuccess or on failure this.sendFail
	 * passing return data as the first parameter.
	 * 
	 * @param  {event} event The event object for this postMessage containing the data.
	 * @return {void}
	 */
	function recieveMessage( event ) {
		var key, data, context, domain = event.origin;
		// Validate the events origin is an expected value.
		if ( -1 === _indexOf( domains, domain ) ) {
			return;
		}
		// Undecoded JSON as key.
		key = event.data;
		// Setup the callback context
		context = {
			sendSuccess: _sendResponse( true, domain, key ),
			sendFail: _sendResponse( false, domain, key ),
			sendNotification: _sendResponse( 'notify', domain, key )
		};
		// Try to decode the data.
		try {
			if ( !! key ){
				data = JSON.parse( key );
			} else {
				context.sendFail( { error: 'Unable to decode data' } );
				return;
			}
		} catch ( e ) {
			context.sendFail( { error: 'Unable to decode data' } );
			return;
		}
		// Check for ping requests
		if ( 'ping' === data.action ) {
			_initPing();
			return;
		}
		// Make sure we have the required response keys.
		if ( ! data.action || ! callbacks[ data.action ] ) {
			context.sendFail( { error: 'No callable action' } );
			return;
		}
		// Call the callback
		callbacks[ data.action ].call( context, data.data, domain );
	}
	/**
	 * Adds or overwrites an action/callback pair.
	 * 
	 * @param {string}   action   The action that triggers this callback
	 * @param {Function} callback The callback function to run for this action.
	 */
	function addAction( action, callback ) {
		if ( 'string' === typeof action && 'function' === typeof callback ) {
			callbacks[ action ] = callback;
		}
	}
	/**
	 * removes an available action/callback pair.
	 * 
	 * @param {string}   action   The action that triggers this callback
	 * @param {Function} callback The callback function to run for this action.
	 */
	function removeAction( action ) {
		if ( 'string' === typeof action && !! callbacks[ action ] ) {
			delete callbacks[ action ];
		}
	}
	/**
	 * Adds a shutdown method to be called just before the de-init message goes out.
	 *
	 * @param {Function} method The method to call on shutdown.
	 * @return {void}
	 */
	function registerShutdown( method, data ){
		if ( 'function' === typeof method ) {
			shutdown.push( { method: method, data: data } );
		}
	}
	/**
	 * Makes the actual postMessage request to the parent on a failed request.
	 * 
	 * @param  {object} message The response data object.
	 * @return {void}
	 */
	function _sendResponse( success, domain, key ) {
		return function sendResponse( data ) {
			var response = { success: success, key: key, url: initURL, data: data };
			client.postMessage( JSON.stringify( response ), domain );
		};
	}
	/**
	 * Sends an init ping.
	 *
	 * @return {void}
	 */
	function _initPing() {
		initOrigin = document.referrer.match( /^(https?:\/\/[^\/]*).*?/ );
		initOrigin = ( !! initOrigin ) ? initOrigin[1] : '*';
		initialized = true;
		client.postMessage( JSON.stringify( { init: 'xq-init', server: initURL } ), initOrigin );
	}
	/**
	 * Sends a de-init ping.
	 *
	 * @return {void}
	 */
	function _deInitPing() {
		if ( initialized ) {
			_shutdown();
			client.postMessage( JSON.stringify( { init: 'xq-de-init', server: initURL } ), initOrigin );
		}
	}
	/**
	 * Runs all shutdown methods prior to sending a de-init ping.
	 * 
	 * @return {void}
	 */
	function _shutdown() {
		var i, length;
		for ( i = 0, length = shutdown.length; i < length; i++ ) {
			shutdown[i].method( shutdown[i].data );
		}
	}
	/**
	 * Helper function to allow indexOf array operations on browsers that don't support them.
	 * 
	 * @param  {array}  array The array to search.
	 * @param  {mixed}  item  The item to search for
	 * @return {number}       The index of the item in the array or -1 if not present.
	 */
	function _indexOf( array, item ) {
		var i, length;
		if ( Array.prototype.indexOf ) {
			return array.indexOf( item );
		}
		for ( i = 0, length = array.length; i < length; i++ ) {
			if ( item === array[ i ] ) {
				return i;
			}
		}
		return -1;
	}
	// Add listeners according to browser capability
	if ( window.addEventListener ) {
		window.addEventListener( 'message', recieveMessage, false );
		window.addEventListener( 'unload', _deInitPing, false );
	} else if ( window.attachEvent ) {
		window.attachEvent( 'onmessage', recieveMessage );
		window.attachEvent( 'onunload', _deInitPing );
	}
	// Return our setup function
	return setup;
})( window, document );