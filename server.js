var port = process.env.PORT || 1945;
var express = require('express');
var https = require('https');
var decodejwt = require('./decodejwt.js');
var getAccessToken = require('./getAccessToken.js');
var cookieParser = require('cookie-parser')
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('mongodb://HRPredictMongo:jwznStM5KoSg8LWr1NkEwKY9oUkEzxWNuH7a8YxzJFY-@ds036648.mongolab.com:36648/HRPredictMongo');

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

app.use(function(req,res,next){
    req.db = db;
    next();
});

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
	var me = {
		currentTime: new Date()
	};
	
	var userId = request.cookies.userId;
	
	if (userId) {
		var db = request.db;
		var userCollection = db.get("usercollection");
		userCollection.findById(userId)
			.success(function (user) {
				console.log("Found user in /api/me lookup");
				me.aadUser = user.aadTokens.idToken;
				me.msaUserId = user.msaUserId;
				response.send(me);
				response.end();
			})
			.error(function (err) {
				console.log("Error looking up user in /api/me lookup: " + err);
			});
	} else {
		response.send(me);
		response.end();
	}
});

app.get('/api/me/historicalData', function(request, response) {
	
	var startDate = request.query.start;
	var endDate = request.query.end;
	
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

function catchCode(request, response, authConfig, scopes, resource, documentCreationFunction, documentFindFunction) {
	var cookieUserId = request.cookies.userId;
	var db = request.db;
	var userCollection = db.get('usercollection');
	var protocol = port == 1945 ? "http" : "https";

	function updateUserInfo(userId, documentObject) {
		userCollection.updateById(userId, documentObject)
			.error(function (err) { console.log("Error: " + err); })
			.success(function (user) { console.log("Successfully updated user"); });
	}

	function setCookieRedirectAndEndRequest(newUserIdCookieValue) {
		if (newUserIdCookieValue) {
			console.log("Setting cookie to: " + newUserIdCookieValue);
			response.cookie('userId', newUserIdCookieValue, { maxAge: 900000, httpOnly: true });
		}
		response.writeHead(302, {"Location": request.protocol + '://' + request.get('host') + '/app.html#/login'});
		response.end();
	}
	
	var redirectUrl = protocol + '://' + request.get('host') + request.path;
	if (!request.query.code) {
		response.writeHead(302, {"Location": getAccessToken.getAuthorizationEndpointUrl(authConfig, redirectUrl, scopes, resource)});
		response.end();
	} else {
		getAccessToken.getTokenResponseWithCode(authConfig, request.query.code, redirectUrl, function(error, tokenResponseData) {
			if (error) {
				console.log("Error getting token response");
				response.writeHead(200, {"Content-Type": "text/plain"});
				response.write("Error: " + error);
				response.end();
			} else {
				var tokenResponse = JSON.parse(tokenResponseData);
				
				var userUpdateDocument = documentCreationFunction(tokenResponse);
				
				if (cookieUserId) {
					console.log("Found user id cookie");
					//replace the current user's aad user info with what we get back from catchcode
					updateUserInfo(cookieUserId, userUpdateDocument);
					setCookieRedirectAndEndRequest();
				} else {
					console.log("No user id cookie found");
					//try to find a current user with this aad id
					userCollection.findOne(documentFindFunction(tokenResponse))
						.success(function(user) {
							updateUserInfo(user._id, userUpdateDocument);
							setCookieRedirectAndEndRequest(user._id);
						})
						.error(function(err) {
							userCollection.insert(userUpdateDocument)
								.success(function(user) {
									setCookieRedirectAndEndRequest(user._id);
								})
								.error(function(err) {
									console.log("Error: " + err);
								});
						});
				}
			}
		});
	}
}

app.get('/catchCode/msa', function(request, response) {
	
	function createMsaDocumentObject(tokenResponse) {
		return {
				msaUserId: tokenResponse.user_id,
				msaTokens: {
					accessToken: tokenResponse.access_token,
					refreshToken: tokenResponse.refresh_token
				}
			};
	}
	
	function findMsaDocumentObject(tokenResponse) {
		return { msaUserId: tokenResponse.user_id };
	}
		
	catchCode(request, response, authConfig.MSA, "mshealth.ReadProfile%20mshealth.ReadActivityHistory%20offline_access", null, createMsaDocumentObject, findMsaDocumentObject);		
});




app.get('/catchCode/aad', function(request, response) {

	function createAadDocumentObject(tokenResponse) {
		var idToken = decodejwt.decodeJwt(tokenResponse.id_token).payload;
		
		return {
				aadUserId: idToken.oid,
				aadTokens: {
					accessToken: tokenResponse.access_token,
					refreshToken: tokenResponse.refresh_token,
					idToken: idToken 
				}
			};
	}
	
	function findAadDocumentObject(tokenResponse) {
		var idToken = decodejwt.decodeJwt(tokenResponse.id_token).payload;
		return { aadUserId: idToken.oid };
	}

	catchCode(request, response, authConfig.AAD, null, "https://outlook.office365.com", createAadDocumentObject, findAadDocumentObject);
});

// /// catch 404 and forwarding to error handler
// app.use(function(req, res, next) {
//     var err = new Error('Not Found');
//     err.status = 404;
//     next(err);
// });

console.log("Starting server on port " + port + "...");
app.listen(port);