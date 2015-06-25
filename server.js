var port = process.env.PORT || 1945;
var express = require('express');
var https = require('https');
var decodejwt = require('./decodejwt.js');
var getAccessToken = require('./getAccessToken.js');
var cookieParser = require('cookie-parser')

var tokenCache = {};

var app = express();

var authConfig = {
	AAD: {
		stsTokenPath: "/common/oauth2/token",
		stsAuthorizationPath: "/common/oauth2/authorize",
		stsHostName: "login.microsoftonline.com",
		clientId: "f531c26a-4d16-44b9-80cf-aa49d7394fbb",
		clientSecret: "%2BoX1vOIHrkkHxYcuvclxi8sHsFn5uEf4bhaGhNXqJqI%3D" //already url encoded
	},
	MSA: {
		stsTokenPath: "/oauth20_token.srf",
		stsAuthorizationPath: "/oauth20_authorize.srf",
		stsHostName: "login.live.com",
		clientId: "000000004415354E",
		clientSecret: "zgDE2DuPotxa4AJNxelJwAarftiwasm3"
	}
};

var msHealthHostName = "apibeta.microsofthealth.net";
var calendarHostName = "outlook.office365.com";

app.use('/', express.static(__dirname + "/public"));
app.use(cookieParser());

app.get('/', function(request, response) {
	response.writeHead(200, {"Content-Type": "text/plain"});
	var aadUser = request.cookies.currentAadUser;
	var msaUserId = request.cookies.currentMsaUserId;
	if (aadUser && aadUser.oid && tokenCache[aadUser.oid]) {
		response.write("AAD User " + aadUser.given_name + " " + aadUser.family_name + "!/r/n");
	} 
	if (msaUserId && tokenCache[msaUserId]) {
		response.write("MSA User ID " + msaUserId + "!/r/n");
	} 
	response.end();
});

app.get('/api/me', function(request, response) {
	response.writeHead(200, {"Content-Type": "application/json"});
	var aadUser = request.cookies.currentAadUser;
	var msaUserId = request.cookies.currentMsaUserId;
	var me = {};
	if (aadUser && aadUser.oid && tokenCache[aadUser.oid]) {
		me.aadUser = aadUser;
	} 
	if (msaUserId && tokenCache[msaUserId]) {
		me.msaUserId = msaUserId;
	} 
	response.send(me);
	response.end();
});

app.get('/api/me/historicalData', function(request, response) {
	
	var startDate = "2015-06-23T00:00:00Z";
	var endDate = "2015-06-24T00:00:00Z";
	
	var msaUserId = request.cookies.currentMsaUserId;
	var aadUser = request.cookies.currentAadUser;
	
	var requestsCompleted = 0;
	
	if (msaUserId && tokenCache[msaUserId] && aadUser && aadUser.oid && tokenCache[aadUser.oid]) {
		var healthResponseData = "";
		var calendarResponseData = "";
		
		var healthRequest = https.request({
			hostname: msHealthHostName,
			port: 443,
			path: '/v1/me/summaries/hourly?startTime=' + startDate + '&endTime=' + endDate,
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Authorization': 'Bearer ' + tokenCache[msaUserId].accessToken
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
				'Authorization': 'Bearer ' + tokenCache[aadUser.oid].accessToken
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
				response.send(mergeHealthAndCalendarData(JSON.parse(healthResponseData), JSON.parse(calendarResponseData)));
				response.end();
			}
		}
	} else {
		response.writeHead(500);
		response.end();	
	}
});

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
		} 
	}
	
	return events;
}
//19:00:00, 20:00:00, 18:00:00, 19:00:00
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

// app.get('/groupChoices', function(request, response) {
// 	var currentUser = tokenCache[request.cookies.currentUser.oid];
// 	if (currentUser && currentUser.accessToken) {
// 		var groupResponseData = "";
// 		var groupRequest = https.request({
// 			hostname: graph_host,
// 			port: 443,
// 			path: '/' + request.cookies.currentUser.tid + '/users/' + request.cookies.currentUser.upn + '/memberOf?api-version=1.5',
// 			method: 'GET',
// 			headers: {
// 				'Accept': 'application/json',
// 				'Authorization': 'Bearer ' + currentUser.accessToken
// 			}
// 		}, function(groupResponse) {
// 			groupResponse.on("error", function(error) {
// 				console.log(error.message);
// 			});
// 			groupResponse.on("data", function(data) {
// 				groupResponseData += data.toString();
// 			});
// 			groupResponse.on("end", function() {
// 				response.send(JSON.parse(groupResponseData));
// 				response.end()
// 			});
// 		});
// 		groupRequest.end();
// 	} else {
// 		response.writeHead(500);
// 		response.end();
// 	}
// });

// app.get('/siteChoices', function(request, response) {
// 	var search_host = 'msft-my.spoppe.com';
// 	var currentUser = tokenCache[request.cookies.currentUser.oid];
// 	var querytext = "contentclass:STS_Site";
// 	if (request.query.querytext) {
// 		querytext = request.query.querytext + "%20AND%20contentclass:STS_Site";
// 	}
// 	getAccessToken.getTokenResponseWithRefreshToken("https://" + search_host + "/", client_id, client_secret, currentUser.refreshToken, "", function(error, tokenResponseData) {
// 		if (!error) {
// 			var siteResponseData = "";
// 			var siteRequest = https.request({
// 				hostname: search_host,
// 				port: 443,
// 				path: "/_api/search/query?querytext='" + querytext + "'",
// 				method: 'GET',
// 				headers: {
// 					'Accept': 'application/json',
// 					'Authorization': 'Bearer ' + tokenResponseData.access_token
// 				}
// 			}, function(siteResponse) {
// 				siteResponse.on("error", function(error) {
// 					console.log(error.message);
// 				});
// 				siteResponse.on("data", function(data) {
// 					siteResponseData += data.toString();
// 				});
// 				siteResponse.on("end", function() {
// 					response.send(JSON.parse(siteResponseData));
// 					response.end()
// 				});
// 			});
// 			siteRequest.end();
// 		} else {
// 			response.writeHead(500);
// 			response.end();
// 		}
// 	});

// });


app.get('/catchCode/msa', function(request, response) {
	var protocol = "https"; //request.connection.encrypted ? "https" : "http";
	var redirectUrl = protocol + '://' + request.get('host') + request.path;
	if (!request.query.code) {
		response.writeHead(302, {"Location": getAccessToken.getAuthorizationEndpointUrl(authConfig.MSA, redirectUrl, "mshealth.ReadProfile%20mshealth.ReadActivityHistory%20offline_access")});
		response.end();
	} else {
		getAccessToken.getTokenResponseWithCode(authConfig.MSA, request.query.code, redirectUrl, function(error, tokenResponseData) {
			if (error) {
				response.writeHead(200, {"Content-Type": "text/plain"});
				response.write("Error: " + error);
				response.end();
			} else {
				var tokenResponse = JSON.parse(tokenResponseData);
				tokenCache[tokenResponse.user_id] = { 
					accessToken: tokenResponse.access_token,
					refreshToken: tokenResponse.refresh_token
				};
				response.cookie('currentMsaUserId', tokenResponse.user_id, { maxAge: 900000, httpOnly: true });
				response.writeHead(302, {"Location": request.protocol + '://' + request.get('host') + '/'});
				response.end();
			}
		});
	}
});

app.get('/catchCode/aad', function(request, response) {
	var protocol = "https"; //request.connection.encrypted ? "https" : "http";
	var redirectUrl = protocol + '://' + request.get('host') + request.path;
	if (!request.query.code) {
		response.writeHead(302, {"Location": getAccessToken.getAuthorizationEndpointUrl(authConfig.AAD, redirectUrl, null, "https://outlook.office365.com")});
		response.end();
	} else {
		getAccessToken.getTokenResponseWithCode(authConfig.AAD, request.query.code, redirectUrl, function(error, tokenResponseData) {
			if (error) {
				response.writeHead(200, {"Content-Type": "text/plain"});
				response.write("Error: " + error);
				response.end();
			} else {
				var tokenResponse = JSON.parse(tokenResponseData);
				var idToken = decodejwt.decodeJwt(tokenResponse.id_token).payload;
				tokenCache[idToken.oid] = { 
					accessToken: tokenResponse.access_token,
					refreshToken: tokenResponse.refresh_token,
					idToken: idToken 
				};
				response.cookie('currentAadUser', idToken, { maxAge: 900000, httpOnly: true });
				response.writeHead(302, {"Location": request.protocol + '://' + request.get('host') + '/'});
				response.end();
			}
		});
	}
});

console.log("Starting server on port " + port + "...");
app.listen(port);