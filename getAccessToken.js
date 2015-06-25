var https = require('https');

module.exports = {
  getAuthorizationEndpointUrl: function (authConfig, redirectUri, scopes, resource) {
    var basicUrl = "https://" + authConfig.stsHostName + authConfig.stsAuthorizationPath + "?client_id=" + authConfig.clientId + "&response_type=code&redirect_uri=" + redirectUri; 
    if (scopes) {
      basicUrl += "&scope=" + scopes;
    }
    if (resource) {
      basicUrl += "&resource=" + resource;
    }
    return basicUrl; 
  },
  getTokenResponseWithRefreshToken: function (authConfig, refreshToken, redirectUri, callback) {
    makeTokenRequest(authConfig, constructBaseTokenRequestBody(authConfig, redirectUri) + "&grant_type=refresh_token&refresh_token=" + refreshToken, callback);
  },
  getTokenResponseWithCode: function (authConfig, code, redirectUri, callback) {
    makeTokenRequest(authConfig, constructBaseTokenRequestBody(authConfig, redirectUri) + "&grant_type=authorization_code&code=" + code, callback);
  }
};

function constructBaseTokenRequestBody(authConfig, redirectUri) {
  return "redirect_uri=" + redirectUri + "&client_id=" + authConfig.clientId + "&client_secret=" + authConfig.clientSecret;
}

function makeTokenRequest(authConfig, requestBody, callback) {
  var options = {
    hostname: authConfig.stsHostName,
    path: authConfig.stsTokenPath,
    method: "POST",
    port: 443,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': requestBody.length
    }
  };
  var tokenResponseData = "";
  var tokenRequest = https.request(options, function(tokenResponse) {
    tokenResponse.on("error", function(error) {
      console.log(error.message);
    });
    tokenResponse.on("data", function(data) {
      tokenResponseData += data.toString();
    });
    tokenResponse.on("end", function() {
      callback(null, tokenResponseData);
    });
  });
  tokenRequest.write(requestBody);
  tokenRequest.end();
};
