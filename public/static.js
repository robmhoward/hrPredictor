var hrPredictorApp = angular.module("hrPredictorApp", ['ngRoute', 'ngMaterial']);

hrPredictorApp.config(['$routeProvider', '$httpProvider', function ($routeProvider, $httpProvider) {  
	$routeProvider
		.when('/profile',
			{
				controller: 'LoginController',
				templateUrl: 'partials/profile.html'
			})
		.when('/historicalData',
			{
				controller: 'HistoricalDataController',
				templateUrl: 'partials/historicalData.html'
			})
		.when('/predictionData',
			{
				controller: 'PredictionDataController',
				templateUrl: 'partials/predictionData.html'
			})			
		.otherwise({redirectTo: '/profile' });
}]);


hrPredictorApp.factory('hrPredictorFactory', ['$http', function ($http) {
	var factory = {};

	factory.getMe = function() {
		return $http.get('/data/me.json');
	}
	
	factory.updateMe = function(me) {
		return $http.patch('/api/me', me);
	}
	
	factory.getHistoricalData = function(startDate, endDate) {
		return $http.get('/data/historicalData.json'); //  /api/me/historicalData?start=' + startDate.toISOString() + '&end=' + endDate.toISOString());
	}
	
	factory.getPredictionData = function(startDate, endDate) {
		return $http.get('/data/predictionData.json'); //  /api/me/predictionData?start=' + startDate.toISOString() + '&end=' + endDate.toISOString());
	}

	return factory;
}]);

hrPredictorApp.controller("MenuController", function($scope, $location) {

	$scope.goto = function(path) {
		$location.path(path);
	}
});

hrPredictorApp.controller("LoginController", function($scope, $q, hrPredictorFactory) {

	$scope.me = [{name: "Loading..."}];
	
	hrPredictorFactory.getMe().then(function(response) {
		$scope.me = response.data;
	});
	
	$scope.updateProfile = function() {
		hrPredictorFactory.updateMe($scope.me);
	};
});

hrPredictorApp.controller("HistoricalDataController", function($scope, $q, hrPredictorFactory) {

	$scope.dateLabel = "(Loading...)";
	
	var startDate = new Date();
	startDate.setDate(startDate.getDate() - 1);
	startDate.setHours(0);
	startDate.setMinutes(0);
	startDate.setSeconds(0);
	startDate.setMilliseconds(0);
		
	var endDate = new Date();
	endDate.setDate(endDate.getDate());
	endDate.setHours(0);
	endDate.setMinutes(0);
	endDate.setSeconds(0);
	endDate.setMilliseconds(0);
	
	
	hrPredictorFactory.getHistoricalData(startDate, endDate).then(function(response) {
		for (var i=0; i < response.data.length; i++) {
			var event = response.data[i];
			if (event.AverageHeartRate < 75) {
				event.Color = "green";
			} else if (event.AverageHeartRate > 90) {
				event.Color = "red";
			} else {
				//event.Color = "blue";
			}
		}
		
		response.data.sort(function (a, b) {
			return b.AverageHeartRate - a.AverageHeartRate;
		});
		
		$scope.events = response.data;
		$scope.dateLabel = "for " + startDate.toDateString();
	});

});

hrPredictorApp.controller("PredictionDataController", function($scope, $q, hrPredictorFactory) {

	$scope.dateLabel = "(Loading...)";
	
	var startDate = new Date();
	startDate.setDate(startDate.getDate());
	startDate.setHours(0);
	startDate.setMinutes(0);
	startDate.setSeconds(0);
	startDate.setMilliseconds(0);
		
	var endDate = new Date();
	endDate.setDate(endDate.getDate() + 1);
	endDate.setHours(0);
	endDate.setMinutes(0);
	endDate.setSeconds(0);
	endDate.setMilliseconds(0);
	
	
	hrPredictorFactory.getPredictionData(startDate, endDate).then(function(response) {
		for (var i=0; i < response.data.length; i++) {
			var event = response.data[i];
			if (event.PredictedHeartRate < 75) {
				event.Color = "green";
			} else if (event.PredictedHeartRate > 90) {
				event.Color = "red";
			} else {
				//event.Color = "blue";
			}
		}
		
		response.data.sort(function (a, b) {
			return b.PredictedHeartRate - a.PredictedHeartRate;
		});
		
		$scope.events = response.data;
		$scope.dateLabel = "for " + startDate.toDateString();
	});


});