#Cross Query

Cross Query is a small library to make implementing the Javascript postMessage API just a bit easier. If you have ever needed cross origin communication between a window and a contained iframe, or between two windows, postMessage is the way to do it. It does however require impementation on both domains for it to work properly. Cross Query makes this easy and efficient providing browser support down to IE 8.

##How Cross Query works

Because code is needed on both sending and recieving sides, Cross Query is set up in two parts, a client script and a server script. 

Include the cleint script on the main window. Then call `myFrame = xq(object, options);` passing it information about the window/frame you'd like to query. It returns a helper object that you can use to make the actual queries, for example `myFrame.query({ action: 'theAction', data: data});`.

On the child frame/window, include the Cross Query server script. You can then call `xqServer({action: callback}, ['http://parent.com']);` and pass it an object of actions and callbacks, as well as an array of valid origins requests can come from. Each object key is an action and each value is a callback function. You can set up as many action/callback pairs as desired. When an action is invoked from the main window, the associated callback is called and passed any sent data. Its `this` context is set to a helper object that allows you to send success or error messages back to the main window with `this.sendSuccess(data);` and `this.sendFail(data);`.

When you make a query from the client, you are returned a deferred object that you can attach callback functions to. See http://api.jquery.com/category/deferred-object/ for more information on using deferred objects to attach callback functions that will be called when the server send success or failures back.

And with that data is going round trip from the main window to a child frame/window, being processed and sent back to the main window.

##Setting up the client

The `xq()` function will take either a url string or a reference to an iframe DOM node as it's first parameter. In the event an iframe node is passed, it will make queries of that frame. This is great if you have an iframe that is embedded in your page already. On the other hand, you can have Cross Query create an iframe or new window for you. If you call `exampleCom = xq('http://example.com/some/path/');`, cross query will create a hidden iframe to http://example.com/some/path for you and append it to the DOM. You can also control the attributes of the iframe a by passing them in the options object. For instance `exampleCom = xq('http://example.com/some/path/', {width: 30, height:50, style: 'display: block;'});`. Similarly you can request that Cross Query create a new window by passing `{window: true, attrs: 'width=300,height=300,navigation=0'}` in the options. No matter which setup method you use, once you have called `xq()` and recieved the helper object, you can call `.query()` to make queries of the frame.

##New windows

Cross Query will work to facilitate communication between two windows, but there are some caveates that you should be aware of. It is wise to keep these limitations in mind when developing your system.

 - **Mobile systems:** Mobile browsers typically halt execution of scripts in non-active windows. This is a problem if you are trying to communicate between two open windows. One window can make a request of the second window, and the mobile browsers in most smartphones DO support this. However, if the user doesn't manually switch back and for between the two windows to allow them to process the request, than the communication never actually has a chance to occur.
 - **Internet Explorer:** IE 8 and 9 do not support cross window communication with postMessage. Cross Query does provide a solution to this problem, however, in the form of its proxy client and server code. To make use of it, the easiest way is to include the proxy code in IE conditional comments immediately after including the main Cross Query files. The proxy works by loading the new window URL in a hidden iframe, communicating with the iframe via postMessage, and then making use of localStorage and the `storage` event that is supported down to IE8 to transfer the request to the window. In terms of the API, aboslutely nothing changes. The code to interface with the window works exactly the same as it would if you were querying the window directly with Cross Query's postMessage transport.

##Callbacks

After making a query of the child frame or window, a promise object is returned which can be used to attach callbacks. When the action is called on the server it can return success or failure and additional data using `this.sendSuccess(data)` and `this.sendFail(data)`. When the data is sent back, any callbacks attahced to the promise object are called with the sent data.

##Query Caching

When you make a request, the returned result is temporarily cached in memory. You can request to continue using the cached version of your query by passing `true` as the second argument of the `.query()` method. The original promise object is returned, and any callback you attach to it will be called immediately with the latest returned data.

##Timeouts

When you set up 

##Examples

 - Make http to https ajax requests [down to IE8](http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx).
 - Get cookie information from another domain
 - Trigger actions in another window.
 - 