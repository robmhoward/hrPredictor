var port = process.env.PORT || 1945;
var express = require('express');
var https = require('https');
// var decodejwt = require('./decodejwt.js');
var getAccessToken = require('./getAccessToken.js');
var cookieParser = require('cookie-parser')

var tokenCache = {};

var app = express();

var client_id = "000000004415354E";
var client_secret = "zgDE2DuPotxa4AJNxelJwAarftiwasm3";

var authorizationEndpoint = "https://login.live.com/oauth20_authorize.srf?client_id=" + client_id + "&scope=mshealth.ReadProfile%20mshealth.ReadActivityHistory%20offline_access&response_type=code&redirect_uri=";

app.use('/', express.static(__dirname + "/public"));
app.use(cookieParser());

app.get('/', function(request, response) {
	var user = request.cookies.currentUser;
	if (user && user.oid && tokenCache[user.oid]) {
		//response.writeHead(200, {"Content-Type": "text/plain"});
		//response.write("Hello " + user.given_name + " " + user.family_name + "!");
		//response.write("OID: " + user.oid);
		if (tokenCache[user.oid]) {
			//response.write("Access Token: " + tokenCache[user.oid].accessToken);	
			response.writeHead(302, {"Location": "pickedItem.html"});
		}
	} else {
		response.writeHead(200, {"Content-Type": "text/plain"});
		response.write("No user");
		// var fullUrl = request.protocol + '://' + request.get('host') + '/catchcode';
		// response.writeHead(302, {"Location": fullUrl});
	}
	response.end();
});

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


app.get('/catchcode', function(request, response) {
	var fullUrl = 'https://' + request.get('host') + request.path;
	if (!request.query.code) {
		response.writeHead(302, {"Location": authorizationEndpoint + fullUrl});
		response.end();
	} else {
		response.write("Making call to get access token");
		getAccessToken.getTokenResponseWithCode(client_id, client_secret, request.query.code, fullUrl, function(error, tokenResponseData) {
			if (error) {
				response.write("Error: " + error);
				response.end();
			} else {
				response.write("Success: " + tokenResponseData);
				response.end();
			}
		});
		// getAccessToken.getTokenResponseWithCode("https://" + graph_host + "/", client_id, client_secret, request.query.code, fullUrl, function(error, tokenResponseData) {
		// 	var idToken = decodejwt.decodeJwt(tokenResponseData.id_token).payload;
		// 	tokenCache[idToken.oid] = { 
		// 		accessToken: tokenResponseData.access_token,
		// 		refreshToken: tokenResponseData.refresh_token,
		// 		idToken: idToken 
		// 	}
		// 	response.cookie('currentUser', idToken, { maxAge: 900000, httpOnly: true });
		// 	response.writeHead(302, {"Location": request.protocol + '://' + request.get('host') + '/'});
		// 	response.end();
		// 	//response.end("Got an id token! " + JSON.stringify(idToken, null, 2));			
		// });
//		response.write(request.query.code);
//		response.end();

	}
});

console.log("Starting server on port " + port + "...");
app.listen(port);