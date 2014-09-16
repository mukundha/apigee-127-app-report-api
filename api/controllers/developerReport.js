'use strict';

var util = require('util');
var request = require('request');
var async = require('async');
var moment = require('moment');

module.exports = {
  getReport: getReport
}

function getReport(req, res) {

	//Read All variables	
  var org = req.swagger.params.orgname.value;
  var env = req.swagger.params.env.value;
  var authHeader = req.get('Authorization');
  var trafficInterval = req.swagger.params.interval.value ;
  var sumOfTrafficGt = req.swagger.params.sumOfTrafficGt.value ;
  var sumOfTrafficLt = req.swagger.params.sumOfTrafficLt.value ;

  //Init urls for apps and analytics
  var app_url = 'https://api.enterprise.apigee.com/v1/o/' + org+'/apps?expand=true' ;
  var app_options = {
  	"url": app_url,
  	headers: {
  		"Authorization": authHeader,
  		"Accept": "application/json"
  	}
  };

  var from = moment();
  var to =moment();
  if(!trafficInterval)
  	trafficInterval = 'week';

  if(trafficInterval =='day'){
  	from = from.subtract('days',1);
  }else if(trafficInterval=='hour'){
  	from= from.subtract('hour',1);
  }else {
  	//default is week
  	from=from.subtract('days',7);
  }

  var format= 'MM%2FDD%2FYYYY+HH:mm:ss';

  var fromTimeStamp = from.format(format);
  var toTimeStamp = to.format(format);

  var analyticsUrl = 'https://api.enterprise.apigee.com/v1/o/' + org+'/e/' + env+'/stats/apps?' +
  					  'select=sum(message_count)&sortby=sum(message_count)&'  +
  					  'timeRange=' + fromTimeStamp + '~' + toTimeStamp + '&' + 
  					  'timeUnit=' + trafficInterval +'&tsAscending=true';

  var analytics_options = {
  	"url": analyticsUrl ,
  	headers: {
  		"Authorization" : authHeader, 
  		"Accept" : "application/json"
  	}
  }

  //Gets app and  app analytics data
  async.parallel ([
  		function(callback){
  			console.log(app_options.url);
  			request(app_options,function(err,response,body){
  				callback(null,JSON.parse(body));
  			});
  		},
  		function(callback){
  			console.log(analytics_options.url);
			request(analytics_options,function(err,response,body){
  				callback(null,JSON.parse(body));
  			});
  		}
  	] , function(err, results){
  		async.filter( results[1].environments[0].dimensions ,
			function(dim,cb){
				var values = dim.metrics[0].values;
				var val = 0 ;
				for(var j=0;j<values.length;j++){
					val += parseInt(values[j].value); 
				}
				if(sumOfTrafficLt && val < sumOfTrafficLt )
					cb(true);
				else if (sumOfTrafficGt && val > sumOfTrafficGt )
					cb(true);
				else if(!sumOfTrafficGt && !sumOfTrafficLt)
					cb(true);
				else
					cb(false);
			}, 	
			function(filteredResults){
				console.log('filtered Results');
				console.log(filteredResults);
				async.filter(results[0].app, function(app,cb){
					console.log(app.name);
					for(var i in filteredResults){

						if( filteredResults[i].name == app.name){
							var values = filteredResults[i].metrics[0].values;
							var val = 0 ;
							for(var j=0;j<values.length;j++){
								val += parseInt(values[j].value); 
							}
							app.traffic = val;
							console.log(true);
							cb(true);
							return ;
						}
					}
					cb(false);
					console.log(false);
				},function(finalApps){
					console.log(finalApps);
					res.json(finalApps);
				});
			}
		);
  });

}
