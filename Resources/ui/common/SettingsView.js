//SettingsView Component Constructor
var TopLevelView = require('ui/common/components/TopLevelView');
var DatabaseHelper = require('helpers/DatabaseHelper');
var ButtonView = require('ui/common/components/ButtonView');
var SeparatorView = require('ui/common/components/SeparatorView');
var Palette = require('ui/common/components/Palette');
var ConfirmDialog = require('ui/common/components/ConfirmDialog');

function SettingsView() {
  var topLevelView = new TopLevelView('Settings');
  var self = Ti.UI.createView({
    layout : 'vertical',
    top : '120dip'
  });

  topLevelView.add(self);

  var confirmDialog = new ConfirmDialog("Change of Server", "This will clear the database,\n Are you sure?", onConfirm = function(e) {
    var server_url = textField.getValue();
    Ti.App.Properties.setString('server_url', server_url);
    DatabaseHelper.clearDatabase();
    topLevelView.fireEvent('settings_saved');
    Ti.App.fireEvent('settings.refreshSurveys');
  });
  //label using localization-ready strings from <app dir>/i18n/en/strings.xml
  var label = Ti.UI.createLabel({
    top : '43dip',
    color : '#000000',
    text : 'Server location',
    height : 'auto',
    width : 'auto',
    left : 5
  });
  self.add(label);

  var textField = Ti.UI.createTextField({
    borderStyle : Ti.UI.INPUT_BORDERSTYLE_ROUNDED,
    color : '#336699',
    right : 5,
    left : 5,
    value : Ti.App.Properties.getString('server_url')
  });
  self.add(textField);

  var saveButton = new ButtonView('Save', {
    width : '80%'
  });
  self.add(new SeparatorView(Palette.SECONDARY_COLOR_LIGHT, '5dip'));
  self.add(saveButton);
  saveButton.addEventListener('click', function(e) {
    var server_url = textField.getValue();
    if (server_url.match(/^https?\:\/\/[\w-.]+(\.\w{2,4}|\:\d{2,5})$/i) == null) {
      alert("Your settings are invalid. Please check them before saving.");
    } else if (Ti.App.Properties.getString('server_url') === server_url) {
      topLevelView.fireEvent('settings_saved');
    } else {
      confirmDialog.show();
    }
  });

  return topLevelView;
}

module.exports = SettingsView;
