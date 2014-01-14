(function( window, document, undefined ){
	'use strict';
	// Set up caches and stash a reference to the original method.
	var initialized = false, windowReady = false, locked = false, isIframe = ( ! window.opener ),
		callbacks = {}, queue = [], requests = {}, xqMain = window.xqServer, xqObj,
		messageKey = '', activationKey = '', cryptKey = '', callCount = 0, throttle = 50;
	// **************************
	// Window Methods
	// **************************

	/**
	 * Overloads the main XQServer to account for IE8-9 cross window postMessage support.
	 * 
	 * When setting up callback functions they should take the passed data as an argument. 
	 * When called it's 'this' context will be set to a helper object. To send back data
	 * use this.sendSuccess( data ); or this.sendFail( data );
	 *
	 * The domain list will be ignored in the window, the proxy iframe will work on that.
	 * 
	 * @param  {object} actions    The list of actions and callback functions for this server.
	 * @return {object}            An object containing the servers helper functions.
	 */
	function xqLocalStorage( actions ) {
		var action;
		// Set up callback actions/functions
		for ( action in actions ) {
			if ( 'function' === typeof actions[ action ] ) {
				callbacks[ action ] = actions[ action ];
			}
		}
		// Set up the deactivate notification action.
		callbacks[ 'xqDeactivate' ] = _deactivateRequest;
		_initPing();
		// Allow dynamic adding and removing of actions.
		return { addAction: addAction, removeAction: removeAction };
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
	 * Handles storage event request request.
	 *
	 * If the action in the event data matches a registerred action, that action's callback
	 * function will be invoked with a helper object as it's 'this' context. It will also be
	 * passed the data as a function parameter. When the callback function processes the 
	 * passed data, on success it should call this.sendSuccess or on failure this.sendFail
	 * passing return data as the first parameter.
	 * 
	 * @return {void}
	 */
	function winHandleStorageEvent(){
		var action, rawData, responseData, context;
		if ( ! initialized ) {
			return;
		}
		// Get the action key. If not present, bail, if it is,
		// stash and then remove for future requests.
		action = _getStored( messageKey );
		if ( ! action ) {
			return;
		}
		// If this is an active request, try to get the associated data.
		rawData = _getStored( action ) || '';
		// We have to get the callID before we can return a response, so this might
		// be a black hole in some circumstances.
		try {
			if ( 'string' === typeof rawData ){
				responseData = JSON.parse( rawData );
			} else {
				return;
			}
		} catch ( e ) {
			return;
		}
		// Make sure we have the required data.
		if ( 'object' !== typeof responseData || ! responseData.callID ) {
			return;
		}
		// Setup the callback context
		context = {
			sendSuccess: _sendResponse( true, responseData.callID ),
			sendFail: _sendResponse( false, responseData.callID ),
			sendNotification: _sendResponse( 'notify', responseData.callID )
		};
		if ( ! callbacks[ action ] ) {
			context.sendFail( 'No callable action was sent' );
		}
		// Call the action's callback
		callbacks[ action ].call( context, responseData.data );
	}
	/**
	 * Makes the actual postMessage request to the parent on a failed request.
	 * 
	 * @param  {object} message The response data object.
	 * @return {void}
	 */
	function _sendResponse( success, callID ) {
		return function sendResponse( data ) {
			var response = { success: success, data: data };
			_setStored( messageKey + '-return', callID, JSON.stringify( response ) );
		};
	}
	/**
	 * Sends an init ping.
	 *
	 * @return {void}
	 */
	function _initPing() {
		initialized = true;
		window.localStorage.setItem( activationKey, 'active' );
	}
	/**
	 * Handles an activation request
	 *
	 * return {void}
	 */
	function _deactivateRequest(){
		var sendSuccess = this.sendSuccess;
		function notifyUnload() {
			sendSuccess();
		}
		// Tie to unload.
		_registerUnload( notifyUnload );
	}

	// **************************
	// Iframe Methods
	// **************************

	function xqProxy( actions, domains ){
		xqObj = xqMain( {
			xqProxyActivate: _activateProxy,
			proxyCall: _handleProxyCall
		}, domains );
		initialized = true;
	}
	function ifHandleStorageEvent(){
		var actionKey, rawData, responseData, responesMethod, request;
		if ( '' === activationKey ) {
			return;
		} else if ( ! windowReady ) {
			_checkWindowReady();
			return;
		}
		// Get the action key. If not present, bail, if it is,
		// stash and then remove for future requests.
		actionKey = _getStored( messageKey + '-return' );
		if ( ! actionKey ) {
			return;
		}
		// Get the raw data for this request.
		rawData = _getStored( actionKey ) || '';
		// If this is an active request, send the data back
		if ( requests[ actionKey ] ){
			request = requests[ actionKey ];
			// Try decoding the data.
			try {
				if ( 'string' === typeof rawData ){
					responseData = JSON.parse( rawData );
				} else {
					request.sendFail( { error: 'Unable to decode data' } );
					return;
				}
			} catch ( e ) {
				request.sendFail( { error: 'Unable to decode data' } );
				return;
			}
			if ( 'object' !== typeof responseData ) {
				request.sendFail( { error: 'Unable to decode data' } );
			}

			if ( 'notify' === responseData.success ) {
				responesMethod = 'sendNotification';
			} else {
				responesMethod = ( !! responseData.success ) ? 'sendSuccess' : 'sendFail';
				// This finishes the request, so remove this request reference.
				delete( requests[ actionKey ] );
			}
			// Send back based on response.
			request[ responesMethod ]( responseData.data );
		}
	}
	function _activateProxy( data ) {
		var testVar = this;
		_registerUnload( this.sendSuccess );
		_setKeys( data );
		_checkWindowReady();
		_handleProxyCall.call(
			{ sendSuccess: _windowUnready, sendFail: _windowUnready },
			{ action: 'xqDeactivate' }
		);
	}
	function _handleProxyCall( data ) {
		if ( ! windowReady || locked ) {
			queue.push( { context: this, data: data } );
			return;
		}
		var callData = { callID: data.action + callCount, data: data.data  };
		requests[ callData.callID ] = this;
		callCount++;
		_setStored( messageKey, data.action, JSON.stringify( callData ) );
		_throttle();
	}
	function _checkWindowReady(){
		if ( 'active' === _getStored( activationKey ) ) {
			windowReady = true;
			_fireQueue();
		}
	}
	function _windowUnready() {
		windowReady = false;
		_handleProxyCall.call(
			{ sendSuccess: _windowUnready, sendFail: _windowUnready },
			{ action: 'xqDeactivate' }
		);
	}

	// **************************
	// Helper Methods
	// **************************
	
	function _delegateStorageEvent() {
		if ( ! initialized ) {
			return;
		}
		if ( isIframe ) {
			ifHandleStorageEvent();
		} else {
			winHandleStorageEvent();
		}
	}
	function _setKeys( keyString ) {
		messageKey = keyString.substr( 0, 24 );
		activationKey = keyString.substr( 12, 12 );
		cryptKey = keyString.substr( 24 );
	}
	function _getStored( key ) {
		var data = window.localStorage.getItem( key );
		window.localStorage.removeItem( key );
		return xqServer.decrypt( data, cryptKey );
	}
	function _setStored( superKey, action, data ) {
		window.localStorage.setItem( action, xqServer.crypt( data ) );
		window.localStorage.setItem( superKey, action );
	}
	function _passThrough( data ) {
		return data;
	}
	function _registerUnload( callback ) {
		if ( window.addEventListener ) {
			window.addEventListener( 'unload', callback, false );
		} else if ( window.attachEvent ) {
			window.attachEvent( 'onunload', callback );
		}
	}
	function _throttle() {
		locked = true;
		window.setTimeout( _unlock, 80 );
	}
	function _unlock() {
		locked = false;
		_fireQueue();
	}
	/**
	 * Fires all requests in the queue from when the window is not ready.
	 *
	 * Fires requests 50ms apart to help prevent race conditions.
	 * 
	 * @return {void}
	 */
	function _fireQueue() {
		var item = queue.shift();
		if ( windowReady && item ) {
			_handleProxyCall.call( item.context, item.data );
		}
	}
	// Overload the XQServer according to where this is being loaded.
	if ( ! isIframe ) {
		window.xqServer = xqLocalStorage;
		_setKeys( window.name );
	} else {
		window.xqServer = xqProxy;
	}
	// Allow for an encryption system to be added if desired.
	window.xqServer.crypt = _passThrough;
	window.xqServer.decrypt = _passThrough;
	// Add listeners according to browser capability (IE9 aEL, IE8aE on the document).
	if ( window.addEventListener ) {
		window.addEventListener( 'storage', _delegateStorageEvent, false );
	} else if ( window.attachEvent ) {
		window.document.attachEvent( 'onstorage', _delegateStorageEvent );
	}
})( window, document, undefined );