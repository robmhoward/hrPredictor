var port = process.env.PORT || 1945;
var express = require('express');
var https = require('https');
var bodyParser = require('body-parser');
var decodejwt = require('./decodejwt.js');
var getAccessToken = require('./getAccessToken.js');
var jsonToCsv = require('./jsonToCsv.js');
var getServiceData = require('./getServiceData.js');
var cookieParser = require('cookie-parser')
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('mongodb://HRPredictMongo:jwznStM5KoSg8LWr1NkEwKY9oUkEzxWNuH7a8YxzJFY-@ds036648.mongolab.com:36648/HRPredictMongo');

var app = express();

app.use('/', express.static(__dirname + "/public"));
app.use(cookieParser());
app.use(bodyParser.json()); // for parsing application/json

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

setInterval(sendDigestEmails, 1000 * 60 * 60 * 24);

function sendDigestEmails() {
	var userCollection = db.get('usercollection');
	userCollection.find({}, { stream: true })
		.each(function (user) {
			console.log("send email to " + user.aadTokens.idToken.unique_name);
			getServiceData.sendSummaryEmail(user); 
		});
}

app.get('/api/me', function(request, response) {
	var me = {
		currentTime: new Date()
	};
	
	getCurrentUser(request, function(err, user) {
		if (user) {
			me = user;
			me.addUser = me.aadTokens.idToken;
			delete me.aadTokens;
			delete me.msaTokens;
		}
		response.send(me);
		response.end();
	});
});

app.post('/api/me', function(request, response) {
	var cookieUserId = request.cookies.userId;
	if (request.body && cookieUserId) {
		var updateDocument = {};
		var validProperties = ["firstName", "lastName", "email", "sendPredictionEmails", "sendSummaryEmails"];
		var updatedProperties = 0;
		for (var i = 0; i < validProperties.length; i++) {
			var postedProperty = request.body[validProperties[i]];
			if (postedProperty) {
				updatedProperties++;
				updateDocument[validProperties[i]] = postedProperty;
			}
		}
		if (updatedProperties > 0) {
			var userCollection = db.get('usercollection');
			userCollection.updateById(cookieUserId, { $set: updateDocument })
				.error(function (err) { console.log("Error: " + err); })
				.success(function (user) { 
						response.writeHead(202);
						response.end();
						console.log("Successfully updated user");
					});
		} else {
			response.writeHead(400);
			response.write("No valid properties to update");
			response.end();
		}
	} else {
		response.writeHead(400);
		response.write("Request is missing user or body");
		response.end();
	}
});

function getCurrentUser(request, callback) {
	var cookieUserId = request.cookies.userId;
	
	if (cookieUserId) {
		console.log("current user cookie found");
		var db = request.db;
		var userCollection = db.get('usercollection');
		
		userCollection.findById(cookieUserId)
			.success(function (user) {
				console.log("current user found in db");
				callback(null, user);
			})
			.error(function (err) {
				console.log("Error finding current user");	
				callback(err);
			});
	} else {
		callback(null, null);
	}
}

app.get('/api/me/historicalDataCsv', function(request, response) {
	handleHistoricalDataRequest(request, response, true);
});

app.get('/api/me/historicalData', function(request, response) {
	handleHistoricalDataRequest(request, response, false);
});

function handleHistoricalDataRequest(request, response, convertToCsv) {
	
	var startDate = new Date(request.query.start);
	var endDate = new Date(request.query.end);
		
	if (startDate && endDate) {
		
		getCurrentUser(request, function(err, user) {	
			if (user) {
				getServiceData.getHistoricalData(startDate, endDate, user, function(err, historicalData) {
					if (err) {
						response.writeHead(400);
						response.write("No user tokens");		
						response.end();
					} else {
						if (convertToCsv) {
							for (var i = 0; i < historicalData.length; i++) {
								historicalData[i].Body = historicalData[i].Body.Content;
								historicalData[i].Location = historicalData[i].Location.DisplayName;
								historicalData[i].Organizer = historicalData[i].Organizer.EmailAddress.Address;
								historicalData[i].ResponseStatus = historicalData[i].ResponseStatus.Response;
								var attendees = "";
								for (var j = 0; j < historicalData[i].Attendees.length; j++) {
									attendees += historicalData[i].Attendees[j].EmailAddress.Address + ';';
								}
								historicalData[i].Attendees = attendees;
							}
							
							response.writeHead(200, {"Content-Type": "text/csv"});
							response.write(jsonToCsv.createCsvString(historicalData));
							response.end();
						} else {
							response.send(historicalData);
							response.end();
						}
					}
				});
			} else {
				response.writeHead(400);
				response.write("No current user");		
				response.end();
			}
		});
	} else {
		response.writeHead(400);
		response.write("You have to specify 'start' and 'end' querystring params in ISO8601 format");		
		response.end();
	}
}

function catchCode(request, response, authConfig, scopes, resource, documentCreationFunction, documentFindFunction) {
	var cookieUserId = request.cookies.userId;
	var db = request.db;
	var userCollection = db.get('usercollection');
	var protocol = port == 1945 ? "http" : "https";

	function updateUserInfo(userId, documentObject) {
		userCollection.updateById(userId, { $set: documentObject })
			.error(function (err) { console.log("Error: " + err); })
			.success(function (user) { console.log("Successfully updated user"); });
	}

	function setCookieRedirectAndEndRequest(newUserIdCookieValue) {
		if (newUserIdCookieValue) {
			console.log("Setting cookie to: " + newUserIdCookieValue);
			response.cookie('userId', newUserIdCookieValue, { maxAge: 900000, httpOnly: true });
		}
		response.writeHead(302, {"Location": request.protocol + '://' + request.get('host') + '/app.html#/profile'});
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
							if (user) {
								updateUserInfo(user._id, userUpdateDocument);
								setCookieRedirectAndEndRequest(user._id);
							} else {
								userUpdateDocument.sendPredictionEmails = true;
								userUpdateDocument.sendSummaryEmails = true;
								userCollection.insert(userUpdateDocument)
									.success(function(user) {
										setCookieRedirectAndEndRequest(user._id);
									})
									.error(function(err) {
										console.log("Error: " + err);
									});
							}
						})
						.error(function(err) {
							console.log("Error: " + err);
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
		
	catchCode(request, response, "MSA", "mshealth.ReadProfile%20mshealth.ReadActivityHistory%20offline_access", null, createMsaDocumentObject, findMsaDocumentObject);		
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
				},
				firstName: idToken.given_name,
				lastName: idToken.family_name,
				email: idToken.upn
			};
	}
	
	function findAadDocumentObject(tokenResponse) {
		var idToken = decodejwt.decodeJwt(tokenResponse.id_token).payload;
		return { aadUserId: idToken.oid };
	}

	catchCode(request, response, "AAD", null, "https://outlook.office365.com", createAadDocumentObject, findAadDocumentObject);
});

// /// catch 404 and forwarding to error handler
// app.use(function(req, res, next) {
//     var err = new Error('Not Found');
//     err.status = 404;
//     next(err);
// });

console.log("Starting server on port " + port + "...");
app.listen(port);