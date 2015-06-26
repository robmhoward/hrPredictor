var hrPredictorApp = angular.module("hrPredictorApp", ['ngRoute', 'ngMaterial'])

hrPredictorApp.config(['$routeProvider', '$httpProvider', function ($routeProvider, $httpProvider) {  
	$routeProvider
		.when('/profile',
			{
				controller: 'LoginController',
				templateUrl: 'partials/profile.html'
			})
		.otherwise({redirectTo: '/' });
}]);


hrPredictorApp.factory('hrPredictorFactory', ['$http', function ($http) {
	var factory = {};

	factory.getMe = function() {
		return $http.get('/api/me');
	}

	return factory;
}]);

hrPredictorApp.controller("LoginController", function($scope, $q, hrPredictorFactory) {

	$scope.me = [{name: "Loading..."}];

	hrPredictorFactory.getMe().then(function(response) {
		$scope.me = response.data;
	});

});