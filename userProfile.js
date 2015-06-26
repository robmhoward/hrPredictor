module.exports = {
	getCurrentUser: getCurrentUser
};



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