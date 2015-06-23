var https = require('https');

module.exports = {
  getTokenResponseWithRefreshToken: function (resource, clientId, clientSecret, refreshToken, redirectUri, callback) {
    makeTokenRequest('grant_type=refresh_token&redirect_uri=' + encodeURIComponent(redirectUri) + '&client_id=' + clientId + '&client_secret=' + encodeURIComponent(clientSecret) + '&refresh_token=' + refreshToken, callback);
  },
  getTokenResponseWithCode: function (resource, clientId, clientSecret, code, redirectUri, callback) {
    makeTokenRequest('grant_type=authorization_code&redirect_uri=' + encodeURIComponent(redirectUri) + '&client_id=' + clientId + '&client_secret=' + encodeURIComponent(clientSecret) + '&code=' + code, callback);
  }
}

function makeTokenRequest(requestBody, callback) {
  var tokenResponseData = "";
  var tokenRequest = https.request({
    //client_id={client_id}&redirect_uri={redirect_uri}&client_secret={client_secret}&refresh_token={refresh_token}&grant_type=refresh_token
    hostname: 'login.live.com',
    port: 443,
    path: 'oauth20_token.srf',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, function(tokenResponse) {
    tokenResponse.on("error", function(error) {
      console.log(error.message);
    });
    tokenResponse.on("data", function(data) {
      tokenResponseData += data.toString();
    });
    tokenResponse.on("end", function() {
      callback(null, JSON.parse(tokenResponseData));
    });
  });
  tokenRequest.write(requestBody);
  tokenRequest.end();
};
