var winston = require('winston');

var logger = new (winston.Logger)({
  transports : [ new winston.transports.Console({
    level : 'info',
    timestamp : true
  }) ],
});

exports.logger = logger;