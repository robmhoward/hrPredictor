var port = process.env.PORT || 1945;
var express = require('express');
var app = express();

app.use('/', express.static(__dirname + "/public"));


console.log("Starting server on port " + port + "...");
app.listen(port);