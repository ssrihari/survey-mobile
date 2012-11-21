var _ = require('lib/underscore')._;
var Answer = require('models/answer');
var Choice = require('models/choice');
var progressBarView = require('ui/common/components/ProgressBar');

var Response = new Ti.App.joli.model({
	table : 'responses',
	columns : {
		id : 'INTEGER PRIMARY KEY',
		survey_id : 'INTEGER',
		web_id : 'INTEGER',
		status : 'TEXT',
		updated_at : 'TEXT',
		latitude : 'REAL',
		longitude : 'REAL'
	},

	methods : {
		createRecord : function(surveyID, status, answersData, location) {
			var record = this.newRecord({
				survey_id : surveyID,
				status : status,
				updated_at : (new Date()).toString(),
				latitude : location.latitude,
				longitude : location.longitude
			});
			record.save();
			_(answersData).each(function(answer) {
				Answer.createRecord(answer, record.id);
			});
			return true;
		},

		validate : function(answersData, status) {
			var errors = {};
			_(answersData).each(function(answerData) {
				var answerErrors = Answer.validate(answerData, status);
				if (!_.isEmpty(answerErrors)) {
					errors[answerData.question_id] = answerErrors;
				}
			});
			return errors;
		}
	},
	objectMethods : {
		prepRailsParams : function() {
			var answer_attributes = {}
			_(this.answers()).each(function(answer, index) {
				answer_attributes[index] = {};
				answer_attributes[index]['question_id'] = answer.question_id;
				answer_attributes[index]['updated_at'] = answer.updated_at;
				if (answer.web_id)
					answer_attributes[index]['id'] = answer.web_id;
				if (answer.hasChoices())
					answer_attributes[index]['option_ids'] = answer.optionIDs();
				else
					answer_attributes[index]['content'] = answer.content;
			});
			return answer_attributes;
		},

		update : function(status, answersData) {
			Ti.API.info("updating response");
			this.fromArray({
				'id' : this.id,
				'survey_id' : this.survey_id,
				'web_id' : this.web_id,
				'status' : status,
				'updated_at' : (new Date()).toString()
			});
			var self = this;
			this.deleteObsoleteAnswers(answersData);
			_(answersData).each(function(answerData) {
				var answer = Answer.findOneById(answerData.id);
				if (answer)
					answer.update(answerData.content);
				else
					Answer.createRecord(answerData, self.id);
			});
			this.save();
			Ti.App.fireEvent('updatedResponse');
			Ti.API.info("response updated at" + this.updated_at);
		},

		deleteObsoleteAnswers : function(answersData) {
			var answerIDs = _(answersData).map(function(answerData) {
				if (answerData.id)
					return answerData.id;
			});
			var obsoleteAnswers = _(this.answers()).select(function(answer) {
				Ti.API.info("answer id " + answer.id);
				return !_(answerIDs).include(answer.id);
			});
			_(obsoleteAnswers).each(function(answer) {
				answer.destroyChoices();
				answer.destroy();
			});
		},

		sync : function() {
			//TODO: REFACTOR THIS.
			var url = Ti.App.Properties.getString('server_url') + '/api/responses';
			var self = this;
			this.synced = false;
			var params = {};
			params['answers_attributes'] = this.prepRailsParams();
			params['status'] = this.status;
			params['survey_id'] = this.survey_id;
			params['updated_at'] = this.updated_at;
			params['longitude'] = this.longitude;
			params['latitude'] = this.latitude;
			var client = Ti.Network.createHTTPClient({
				// function called when the response data is available
				onload : function(e) {
					Ti.API.info("Synced response successfully: " + this.responseText);
					self.has_error = false;
					self.synced = true;

					var received_response = JSON.parse(this.responseText);
					
					self.fromArray({
						'id' : self.id,
						'survey_id' : self.survey_id,
						'web_id' : received_response['id'],
						'status' : received_response['status'],
						'updated_at' : (new Date()).toString()
					});
					self.save();

					_(self.answers()).each(function(answer, index) {
						var image = answer.image;
						var photoUpdatedAt = answer.photo_updated_at;
						answer.destroyChoices();
						answer.destroy();
						var new_answer = Answer.newRecord({
							'response_id' : self.id,
							'question_id' : received_response.answers[index].question_id,
							'web_id' : received_response.answers[index].id,
							'content' : received_response.answers[index].content,
							'updated_at' : (new Date()).toString(),
							'image' : image,
							'photo_updated_at' : photoUpdatedAt
						});
						new_answer.save();

						_(received_response.answers[index].choices).each(function(choice) {
							choice.answer_id = new_answer.id;
							Choice.newRecord(choice).save();
						})
					});

					_(self.answers()).each(function(answer) {
					  if (answer.isImage() && answer.image) {
					    Ti.API.info("Progress uploading image");
              progressBarView.setMessage("Uploading images...");
              progressBarView.updateMax(1);
  						answer.uploadImage(received_response['status'], received_response['id']);
						}
					});

					if (received_response['status'] == "complete") {
						self.destroyAnswers();
						self.destroy();
					}
					
					Ti.App.fireEvent('response.sync', {
						survey_id : self.survey_id
					});
				},
				onerror : function(e) {
				  var message;
					if (this.status == '410') {// Response deleted on server
					  //TODO display verbose error for this case
						Ti.API.info("Response deleted on server: " + this.responseText);
						self.destroyAnswers();
						self.destroy();
					} else if (this.status >= 400) {
            message = "Your server isn't responding. Sorry about that.";
          } else if (this.status == 0) {
            message = "Couldn't reach the server.";
          } else {
						Ti.API.info("Erroneous Response: " + this.responseText);
						self.has_error = true;
					}
					self.synced = true;
					Ti.App.fireEvent('responses.sync.error');
					Ti.App.fireEvent('response.sync', {
						survey_id : self.survey_id,
						message : message
					});
				},
				timeout : 5000 // in milliseconds
			});

			var method = self.web_id ? "PUT" : "POST";
			url += self.web_id ? "/" + self.web_id : "";
			url += ".json";
			client.open(method, url);
			client.setRequestHeader("Content-Type", "application/json");
			client.send(JSON.stringify(params));
		},

		questions : function() {
			var Survey = require('models/survey');
			var survey = Survey.findOneById(this.survey_id);
			var firstLevelQuestions = survey.firstLevelQuestions();
			var questions = _.chain(firstLevelQuestions).map(function(question) {
				return question.withSubQuestions();
			}).flatten().value();
					
			return questions;
		},

		answers : function() {
			var questionIDs = _(this.questions()).map(function(question){ return question.id; });
			var answers = Answer.findBy('response_id', this.id);
			var sortedAnswers = _(answers).sortBy(function(answer) {
				return questionIDs.indexOf(answer.question().id);
			});
			return sortedAnswers;
		},

		destroyAnswers : function() {
			_(this.answers()).each(function(answer) {
				answer.destroyChoices();
				if (answer.isImage() && answer.image)
					Ti.Filesystem.getFile(answer.image).deleteFile();
				answer.destroy();
			})
		},

		answerForQuestion : function(questionID) {
			return _(this.answers()).find(function(answer) {
				return answer.question_id == questionID;
			});
		},

		identifierAnswers : function() {
			var identifiers = _(this.answers()).select(function(answer) {
				return answer.question().identifier;
			});
			if (_(identifiers).isEmpty()) {
				identifiers = this.answers().slice(0, 5);
			}
			return identifiers;

		}
	}
});

Ti.App.joli.models.initialize();
module.exports = Response;

