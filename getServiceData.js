var https = require('https');
var request = require('request');

module.exports = {
	getHistoricalData: getHistoricalData,
	getPredictionData: getPredictionData,
	sendPredictionEmail: sendPredictionEmail
}

var msHealthHostName = "apibeta.microsofthealth.net";
var calendarHostName = "outlook.office365.com";

function sendPredictionEmail(user) {
	
	getPredictionData(user, function(err, calendarResponseData) {
		var calendarEvents = JSON.parse(calendarResponseData).value;
		var emailContent = "<table><tr><td>Start</td><td>Subject</td><td>Organizer</td><td>Location</td><td>Body Preview</td></tr>";
		for (var i = 0; i < calendarEvents.length; i++) {
			var event = calendarEvents[i];

			var startTime = new Date(event.Start);
			var hours = startTime.getHours();
			var minutes = startTime.getMinutes();
			
			if (minutes < 10) minutes = "0" + minutes;
			var suffix = "AM";
			if (hours >= 12) {
				suffix = "PM";
				hours = hours - 12;
			}
			if (hours == 0) {
				hours = 12;
			}
			
			emailContent += "<tr><td>" + hours + ":" + minutes + " " + suffix + "</td><td>" + event.Subject + "</td><td>" + event.Organizer.EmailAddress.Name + "</td><td>" + event.Location.DisplayName + "</td><td>" + event.BodyPreview + "</td></tr>";  
		}
		emailContent += "</table>";
		
		var emailMessage = {
			Message: {
				Subject: 'Test Summary Email',
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

function getPredictionData(user, callback) {
	
	var startDate = new Date();
	startDate.setDate(startDate.getDate() + 1);
	startDate.setHours(0);
	startDate.setMinutes(0);
	startDate.setSeconds(0);
	startDate.setMilliseconds(0);
	
	
	var endDate = new Date();
	endDate.setDate(endDate.getDate() + 2);
	endDate.setHours(0);
	endDate.setMinutes(0);
	endDate.setSeconds(0);
	endDate.setMilliseconds(0);
	
	getCalendarData(startDate, endDate, user, callback);
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
			path: '/v1/me/summaries/hourly?startTime=' + startDate + '&endTime=' + endDate,
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
				checkForCompletionAndProceed();
			});
		});
		healthRequest.end();
						
		var calendarRequest = https.request({
			hostname: calendarHostName,
			port: 443,
			path: '/api/v1.0/me/calendarview?startDateTime=' + startDate + '&endDateTime=' + endDate + '&$select=Subject,Attendees,Body,Location,Organizer,Start,StartTimeZone,End,EndTimeZone,Importance,Type,ResponseStatus&$orderBy=Start,End',
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
		for (var j = 0; j < healthHours.length; j++) {
			if (overlap(healthHours[j].startTime, healthHours[j].endTime, events[i].Start, events[i].End) && healthHours[j].heartRateSummary.averageHeartRate) {
				overlappingHourCount++;
				heartRateTotal += healthHours[j].heartRateSummary.averageHeartRate;
			}
		}
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