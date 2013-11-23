var storage = require('./storage.js').storage;
var util = require('util');
var push = require('pushover-notifications');
var pushover = new push({
  token : process.env.PUSHOVER_TOKEN || "aJoQk1Hxap1FLnRq56KRWSDkTdPuWS",
});

exports.pusher = function(counter) {
  var sendTo = function(user) {
    storage.findAllWordsBy({
      owner : user._id,
      tests : {
        $lte : 16
      }
    }, function(error, words) {
      if (words.lenght === 0) {
        console.log("found no words");
        return;
      }
      var index = Math.floor(Math.random() * words.length);
      var word = words[index];

      console.log("Send word: %j", word);

      pushover.send({
        user : user.pushover_id,
        message : util.format("http://palabra.herokuapp.com/%s/%s", user._id, word._id),
        title : util.format("The word '%s'. ", word.word),
      }, function(error, result) {
        console.log("error: %j", error);
        console.log("result: %j", result);
      });

    });
  };

  return function() {
    console.log("Sending %d", counter);
    storage.findAllUsersBy({
      words_per_day : {
        $gte : counter
      }
    }, function(error, users) {
      for ( var i = 0; i < users.length; i++) {
        console.log("sending to: %s", users[i].email);
        if (!users[i].pushover_id) {
          console.log("no pushover id skipping");
          continue;
        }
        sendTo(users[i]);
      }
    });
  };
};
