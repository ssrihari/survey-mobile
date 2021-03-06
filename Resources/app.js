/*
* Single Window Application Template:
* A basic starting point for your application.  Mostly a blank canvas.
*
* In app.js, we generally take care of a few things:
* - Bootstrap the application with any data we need
* - Check for dependencies like device type, platform version or network connection
* - Require and open our top-level UI component
*
*/

// Setup database
Ti.App.joli = require('lib/joli').connect('AfterUserId', '/db/main.sqlite');

//bootstrap and check dependencies
if (Ti.version < 1.8) {
	alert('Sorry - this application template requires Titanium Mobile SDK 1.8 or later');
}

// This is a single context application with mutliple windows in a stack
(function() {
	//determine platform and form factor and render approproate components
	var osname = Ti.Platform.osname, version = Ti.Platform.version, height = Ti.Platform.displayCaps.platformHeight, width = Ti.Platform.displayCaps.platformWidth;

	//considering tablet to have one dimension over 900px - this is imperfect, so you should feel free to decide
	//yourself what you consider a tablet form factor for android
	var isTablet = osname === 'ipad' || (osname === 'android' && (width > 899 || height > 899));

	var Window;

	// Android uses platform-specific properties to create windows.
	// All other platforms follow a similar UI pattern.
	if (osname === 'android') {
		Window = require('ui/handheld/android/SurveysIndexWindow');
		new Window().open();
	} else {
		Window = Ti.UI.createWindow();
		navGroup = Ti.UI.iPhone.createNavigationGroup({
			window: require('ui/handheld/iphone/SurveysIndexWindow')()
		});
		Window.add(navGroup);
		Window.open();
	}	
	if (Ti.App.Properties.getString('server_url') == null) {
		Ti.App.Properties.setString('server_url', 'http://survey-web-staging.herokuapp.com');
	}
	Ti.include('/test/tests.js');
})();
