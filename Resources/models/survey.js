var _ = require('lib/underscore')._;
var Question = require('models/question');
var Response = require('models/response')

var Survey = new Ti.App.joli.model({
	table : 'survey',
	columns : {
		id : 'INTEGER PRIMARY KEY',
		name : 'TEXT',
		description : 'TEXT',
		expiry_date : 'TEXT'
	},

	methods : {
		fetchSurveys : function() {
			var url = Ti.App.Properties.getString('server_url') + '/api/surveys';
			var that = this;
			var client = Ti.Network.createHTTPClient({
				// function called when the response data is available
				onload : function(e) {
					Ti.API.info("Received text: " + this.responseText);
					data = JSON.parse(this.responseText);
					// Emptying the table for now (until we get all the survey info from the server)
					that.truncate();
					Question.truncate();
					that.createRecords(data);
					_(data).each(function(survey) {
						that.fetchQuestions(survey['id']);
					});
					Ti.App.fireEvent('surveys.fetch.success');
				},
				// function called when an error occurs, including a timeout
				onerror : function(e) {
					Ti.API.debug(e.error);
					Ti.App.fireEvent('surveys.fetch.error', {
						status : this.status
					});
				},
				timeout : 5000 // in milliseconds
			});
			// Prepare the connection.
			client.open("GET", url);
			// Send the request.
			client.send();
		},

		fetchQuestions : function(surveyID) {
			var url = Ti.App.Properties.getString('server_url') + '/api/surveys/' + surveyID;
			var client = Ti.Network.createHTTPClient({
				// function called when the response data is available
				onload : function(e) {
					Ti.API.info("Received text for questions: " + this.responseText);
					data = JSON.parse(this.responseText);
					Question.createRecords(data, surveyID);
				},
				// function called when an error occurs, including a timeout
				onerror : function(e) {
					Ti.API.info("Error");
				},
				timeout : 5000 // in milliseconds
			});
			// Prepare the connection.
			client.open("GET", url);
			// Send the request.
			client.send();
		},

		createRecords : function(data) {
			var that = this;
			_(data).each(function(survey) {
				var record = that.newRecord({
					id : survey.id,
					name : survey.name,
					description : survey.description,
					expiry_date : survey.expiry_date
				});
				record.save();
			});
		},

		isEmpty : function() {
			return this.count() == 0;
		},

		syncResponses : function(surveyID) {
			var responses = Response.findBy('survey_id', surveyID);
			Ti.API.info(responses)
			_(responses).each(function(response) {
				Response.sync(response.id);
			});
			var success_count = 0;
			var syncSuccessHandler = function() {
				success_count++;
				if (success_count == responses.length) {
					Ti.App.fireEvent("syncResponses.success");
					Ti.App.removeEventListener("response.sync.success", syncSuccessHandler);
				}
			};
			
			Ti.App.addEventListener("response.sync.success", syncSuccessHandler);
			
			var error_count = 0;
			var syncErrorHandler = function() {
				error_count++;
				if (error_count == 1) {
					Ti.App.fireEvent("syncResponses.error");
					Ti.App.removeEventListener("response.sync.error", syncErrorHandler);
				}		
			};
			
			Ti.App.addEventListener("response.sync.error", syncErrorHandler);
		}
	}
});

Ti.App.joli.models.initialize();
module.exports = Survey;

