var https = require('https');
var request = require('request');

module.exports = {
	getHistoricalData: getHistoricalData,
	getPredictionData: getPredictionData,
	sendPredictionEmail: sendPredictionEmail,
	sendSummaryEmail: sendSummaryEmail
}

var msHealthHostName = "apibeta.microsofthealth.net";
var calendarHostName = "outlook.office365.com";

function createFriendlyTimeString(dateString) {
	var date = new Date(dateString);
	var hours = date.getHours();
	var minutes = date.getMinutes();
	
	if (minutes < 10) minutes = "0" + minutes;
	var suffix = "AM";
	if (hours >= 12) {
		suffix = "PM";
		hours = hours - 12;
	}
	if (hours == 0) {
		hours = 12;
	}
	
	return hours + ":" + minutes + " " + suffix;
}

function getStartOfDayWithOffsetFromToday(offset) {
	var date = new Date();
	date.setDate(date.getDate() + offset);
	date.setHours(0);
	date.setMinutes(0);
	date.setSeconds(0);
	date.setMilliseconds(0);
	
	return date;
}

function sendSummaryEmail(user) {
	var startDate = getStartOfDayWithOffsetFromToday(-1);
	var endDate = getStartOfDayWithOffsetFromToday(1);
			
	getHistoricalData(startDate, endDate, user, function(err, calendarResponseData) {
		var calendarEvents = calendarResponseData;
		var alternateEmailContent = "<p>Summary of your meetings on " + startDate.toDateString() + "</p>";
		alternateEmailContent += createHtmlTableFromEvents(
			calendarEvents, 
			[
				{displayName: "Start", field: "Start", processor: createFriendlyTimeString},
				{displayName: "Subject", field: "Subject"},
				{displayName: "Organizer", field: "Organizer.EmailAddress.Name"},
				{displayName: "Location", field: "Location.DisplayName"},
				{displayName: "Body Preview", field: "BodyPreview"},
				{displayName: "Average Heart Rate", field: "AverageHeartRate"},
				{displayName: "Steps Taken", field: "StepsTaken"}
			]
		);
		// var emailContent = "<p>Summary of your meetings on " + startDate.toDateString() + "</p>";
		// emailContent += "<table><tr><td>Start</td><td>Subject</td><td>Organizer</td><td>Location</td><td>Body Preview</td><td>Average Heart Rate</td><td>Steps Taken</td></tr>";
		// for (var i = 0; i < calendarEvents.length; i++) {
		// 	var event = calendarEvents[i];
		// 	var startTime = new Date(event.Start);

		// 	emailContent += "<tr><td>" + createFriendlyTimeString(startTime);
		// 	emailContent += "</td><td>" + event.Subject;
		// 	emailContent += "</td><td>" + event.Organizer.EmailAddress.Name;
		// 	emailContent += "</td><td>" + event.Location.DisplayName;
		// 	emailContent += "</td><td>" + event.BodyPreview;
		// 	emailContent += "</td><td>" + event.AverageHeartRate;
		// 	emailContent += "</td><td>" + event.StepsTaken;
		// 	emailContent += "</td></tr>";  
		// }
		// emailContent += "</table>";
		
		var emailMessage = {
			Message: {
				Subject: 'HR Predictor - ' + startDate.toDateString(),
				Body: {	ContentType: 'HTML', Content: alternateEmailContent },
				ToRecipients: [	{ EmailAddress: { Address: user.aadTokens.idToken.unique_name } } ],
			},
			SaveToSentItems: false
		};

		request({
		    url: "https://" + calendarHostName + "/api/v1.0/me/sendMail",
			method: "POST",
			headers: {
				'Authorization': 'Bearer ' + user.aadTokens.accessToken
			},
			port: 443,
		    json: true,
		    body: emailMessage
		}, function (error, response, body){
			if (error) console.log(error);
		});		
	});
}

function createHtmlTableFromEvents(events, properties) {
	var tableString = "<table><tr>";
	for (var i = 0; i < properties.length; i++) {
		tableString += "<td>" + properties[i].displayName + "</td>";
	}
	tableString += "</tr>";
	
	for (var i = 0; i < events.length; i++) {
		tableString += "<tr>";
		for (var j = 0; j < properties.length; j++) {
			tableString += "<td>" + getPropertyValue(events[i], properties[j]) + "</td>";
		}
		tableString += "</tr>";
	}
	tableString += "</table>";
	
	return tableString;
}

function getPropertyValue(event, property) {
	var propertyNameChain = property.field.split('.');
	var propertyValue = event[propertyNameChain[0]];
	for (var i = 1; i < propertyNameChain.length; i++) {
		propertyValue = propertyValue[propertyNameChain[i]];
	}
	
	if (property.processor) {
		return property.processor(propertyValue);
	} else {
		return propertyValue;
	}
}

function sendPredictionEmail(user) {
	
	var startDate = getStartOfDayWithOffsetFromToday(1);
	var endDate = getStartOfDayWithOffsetFromToday(2);
	
	getPredictionData(startDate, endDate, user, function(err, calendarResponseData) {
		var calendarEvents = calendarResponseData;
		var emailContent = "<p>Summary of your meetings on " + startDate.toDateString() + "</p>";
		emailContent += "<table><tr><td>Start</td><td>Subject</td><td>Organizer</td><td>Location</td><td>Body Preview</td><td>Predicted Heart Rate</td></tr>";
		for (var i = 0; i < calendarEvents.length; i++) {
			var event = calendarEvents[i];
			var startTime = new Date(event.Start);
			
			emailContent += "<tr><td>" + createFriendlyTimeString(startTime)
			emailContent += "</td><td>" + event.Subject;
			emailContent += "</td><td>" + event.Organizer.EmailAddress.Name;
			emailContent += "</td><td>" + event.Location.DisplayName;
			emailContent += "</td><td>" + event.BodyPreview;
			emailContent += "</td><td>" + event.PredictedHeartRate;
			emailContent += "</td></tr>";  
		}
		emailContent += "</table>";
		
		var emailMessage = {
			Message: {
				Subject: 'HR Predictor - ' + startDate.toDateString(),
				Body: {
					ContentType: 'HTML',
					Content: emailContent
				},
				ToRecipients: [
					{ EmailAddress: { Address: user.aadTokens.idToken.unique_name } }
				],
			},
			SaveToSentItems: false
		};

		request({
		    url: "https://" + calendarHostName + "/api/v1.0/me/sendMail",
			method: "POST",
			headers: {
				'Authorization': 'Bearer ' + user.aadTokens.accessToken
			},
			port: 443,
		    json: true,
		    body: emailMessage
		}, function (error, response, body){
			if (error) console.log(error);
		});		
	});
}

function getPredictionData(startDate, endDate, user, callback) {
	
	getCalendarData(startDate, endDate, user, function(err, calendarResponseData) {
		var calendarEvents = JSON.parse(calendarResponseData).value;
		getPredictedHeartRates(calendarEvents, function(err, message) {
			callback(null, calendarEvents);
		});
	});
}


function getPredictedHeartRates(calendarEvents, callback) {
	var completedCalls = 0;
	
	for (var i = 0; i < calendarEvents.length; i++) {
		getPredictedHeartRate(calendarEvents[i], function(err, result) {
			completedCalls++;
			if (completedCalls >= calendarEvents.length) {
				console.log("all calls completed");
				callback();
			}
		});
	}
}

function getPredictedHeartRate(event, callback) {
	var requestBody = 
	{
		"Id":"score1",
		"Instance":
			{
				"FeatureVector":
					{
						"userID":"0",
						"meetingSubject": event.Subject,
						"meetingAttendees":"0",
						"meetingBody": event.Body.Content,
						"meetingLocation": event.Location.DisplayName,
						"meetingOrganizer": event.Organizer.EmailAddress.Address,
						"meetingStart": event.Start,
						"meetingEnd": event.End,
						"meetingImportance": event.Importance,
						"meetingType": event.Type,
						"userAverageHeartRate":"0"
					},
				"GlobalParameters":{}
			}
	};

	request({
	    url: "https://ussouthcentral.services.azureml.net/workspaces/b5049852f1c24d9ebbfcd48fdbacce2a/services/01928aeaa447471aa9ccfe5af47542d3/score",
		method: "POST",
		headers: {
			'Authorization': 'Bearer 8yCAqdgEjqcAIKMwWG66TZPQ2DEGVX0OS9O00+4ozmpiFN/WfmBPHWqtwRI00GmOexAhT800xmnVyLfQxWTlmA=='
		},
		port: 443,
	    json: true,
	    body: requestBody
		}, function (error, response, body){
			if (error) console.log(error);
			event.PredictedHeartRate = body[3];
			callback(null, body[3]);
		});	
}

function getCalendarData(startDate, endDate, user, callback) {
	var calendarResponseData = "";
	var calendarRequest = https.request({
		hostname: calendarHostName,
		port: 443,
		path: '/api/v1.0/me/calendarview?startDateTime=' + startDate.toISOString() + '&endDateTime=' + endDate.toISOString() + '&$select=Subject,Attendees,Body,BodyPreview,Location,Organizer,Start,StartTimeZone,End,EndTimeZone,Importance,Type,ResponseStatus&$orderBy=Start,End',
		method: 'GET',
		headers: {
			'Accept': 'application/json',
			'Authorization': 'Bearer ' + user.aadTokens.accessToken
		}			
	}, function(calendarResponse) {
		calendarResponse.on("error", function(error) {
			console.log(error.message);
		});
		calendarResponse.on("data", function(data) {
			calendarResponseData += data.toString();
		});
		calendarResponse.on("end", function() {
			callback(null, calendarResponseData);
		});
	});
	calendarRequest.end();
}


function getHistoricalData(startDate, endDate, user, callback) {
	
	var requestsCompleted = 0;

	if (user && user.msaTokens && user.aadTokens) {
		var healthResponseData = "";
		var calendarResponseData = "";
		
		var healthRequest = https.request({
			hostname: msHealthHostName,
			port: 443,
			path: '/v1/me/summaries/hourly?startTime=' + startDate.toISOString() + '&endTime=' + endDate.toISOString(),
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Authorization': 'Bearer ' + user.msaTokens.accessToken
			}
		}, function(healthResponse) {
			healthResponse.on("error", function(error) {
				console.log(error.message);
			});
			healthResponse.on("data", function(data) {
				healthResponseData += data.toString();
			});
			healthResponse.on("end", function() {
				if (healthResponse.statusCode >= 400) {
					console.log("Error retrieving health info. Code: " + healthResponse.statusCode)
				}
				checkForCompletionAndProceed();
			});
		});
		healthRequest.end();
						
		var calendarRequest = https.request({
			hostname: calendarHostName,
			port: 443,
			path: '/api/v1.0/me/calendarview?startDateTime=' + startDate.toISOString() + '&endDateTime=' + endDate.toISOString() + '&$select=Subject,Attendees,Body,BodyPreview,Location,Organizer,Start,StartTimeZone,End,EndTimeZone,Importance,Type,ResponseStatus&$orderBy=Start,End&$top=20',
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Authorization': 'Bearer ' + user.aadTokens.accessToken
			}			
		}, function(calendarResponse) {
			calendarResponse.on("error", function(error) {
				console.log(error.message);
			});
			calendarResponse.on("data", function(data) {
				calendarResponseData += data.toString();
			});
			calendarResponse.on("end", function() {
				if (calendarResponse.statusCode >= 400) {
					console.log("Error retrieving calendar info. Code: " + calendarResponse.statusCode)
				}
				checkForCompletionAndProceed();
			});
		});
		calendarRequest.end();
		
		function checkForCompletionAndProceed() {
			requestsCompleted++;
			if (requestsCompleted == 2) {
				callback(null, mergeHealthAndCalendarData(JSON.parse(healthResponseData), JSON.parse(calendarResponseData)));
			}
		}
	} else {
		callback("no tokens", null);
	}
}

function mergeHealthAndCalendarData(healthData, calendarData) {
	var healthHours = healthData.summaries;
	var events = calendarData.value;
	
	for (var i = 0; i < events.length; i++) {
		var heartRateTotal = 0;
		var overlappingHourCount = 0;
		var stepCount = 0;
		for (var j = 0; j < healthHours.length; j++) {
			if (overlap(healthHours[j].startTime, healthHours[j].endTime, events[i].Start, events[i].End) && healthHours[j].heartRateSummary.averageHeartRate) {
				overlappingHourCount++;
				heartRateTotal += healthHours[j].heartRateSummary.averageHeartRate;
				stepCount += healthHours[j].stepsTaken;
			}
		}
		events[i].StepsTaken = stepCount;
		if (overlappingHourCount > 0) {
			events[i].AverageHeartRate = heartRateTotal / overlappingHourCount;
		} else {
			events[i].AverageHeartRate = 0;
		}
	}
	
	return events;
}

function overlap(startDateOne, endDateOne, startDateTwo, endDateTwo) {
	startDateOne = startDateOne.replace('.000+00:00','Z');
	endDateOne = endDateOne.replace('.000+00:00','Z');
	startDateTwo = startDateTwo.replace('.000+00:00','Z');
	endDateTwo = endDateTwo.replace('.000+00:00','Z');
	if (startDateOne >= startDateTwo && startDateOne < endDateTwo) return true;
	if (endDateOne <= endDateTwo && endDateOne > startDateTwo) return true;
	if (startDateOne <= startDateTwo && endDateOne >= endDateTwo) return true;
	return false;
}