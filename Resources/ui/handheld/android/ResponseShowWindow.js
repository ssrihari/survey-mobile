function ResponseShowWindow(responseID) {
	var ResponseShowView = require('ui/common/responses/ResponseShowView')
	var ResponseEditWindow = require('ui/handheld/android/ResponseEditWindow')

	var self = Ti.UI.createWindow({
		navBarHidden : true,
		backgroundColor : "#fff"
	});
	var view = new ResponseShowView(responseID);
	self.add(view);

	view.addEventListener('ResponseShowView:responseEdit', function(e) {
		new ResponseEditWindow(e.responseID).open();
	})

	view.addEventListener('ResponseShowView:responseDeleted', function(e) {
		self.close();
		Ti.App.fireEvent('ResponseShowWindow:closed');
	})

	return self;
}

module.exports = ResponseShowWindow;
