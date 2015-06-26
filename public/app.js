var hrPredictorApp = angular.module("hrPredictorApp", ['ngRoute', 'ngMaterial', 'materialDatePicker']);

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
		return $http.get('/api/me');
	}
	
	factory.updateMe = function(me) {
		return $http.patch('/api/me', me);
	}
	
	factory.getHistoricalData = function(startDate, endDate) {
		return $http.get('/api/me/historicalData?start=' + startDate.toISOString() + '&end=' + endDate.toISOString());
	}
	
	factory.getPredictionData = function(startDate, endDate) {
		return $http.get('/api/me/predictionData?start=' + startDate.toISOString() + '&end=' + endDate.toISOString());
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

	$scope.me = [{name: "Loading..."}];
	
	hrPredictorFactory.getMe().then(function(response) {
		$scope.me = response.data;
	});
	
	$scope.updateProfile = function() {
		hrPredictorFactory.updateMe($scope.me);
	}


});

hrPredictorApp.controller("PredictionDataController", function($scope, $q, hrPredictorFactory) {

	$scope.me = [{name: "Loading..."}];
	
	hrPredictorFactory.getMe().then(function(response) {
		$scope.me = response.data;
	});
	
	$scope.updateProfile = function() {
		hrPredictorFactory.updateMe($scope.me);
	}


});