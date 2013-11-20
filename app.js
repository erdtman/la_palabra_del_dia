var express = require('express');
var flash = require('connect-flash');
var storage = require('./storage.js').storage;
var logger = require('./logger.js').logger;
var util = require('util');
var shortId = require('shortid');
shortId.seed(347826593478562);

var push = require('pushover-notifications');
var pushover = new push({
  token : process.env.PUSHOVER_TOKEN || "aJoQk1Hxap1FLnRq56KRWSDkTdPuWS",
});

var nodemailer = require("nodemailer");
var smtpTransport = nodemailer.createTransport("SMTP", {
  service : "Gmail",
  auth : {
    user : process.env.EMAIL_ADDRESS || "palabra@erdtman.se",
    pass : process.env.EMAIL_PASSWORD || "lapa123!"
  }
});

var app = express();
var port = process.env.PORT || 5001;

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('keyboard cat'));
  app.use(express.session({
    cookie : {
      maxAge : 60000
    }
  }));
  app.use(flash());
  app.use(app.router);
  app.use("/static", express.static(__dirname + '/static'));
  app.use(express.errorHandler({
    showStack : false,
    dumpExceptions : false
  }));
});

app.get('/clear', function(req, res) {
  storage.dropDatabase(function() {
    res.send("clean");
  });
});

app.get('/', function(req, res) {
  res.render('start.jade', {
    flash : req.flash()
  });
});

app.post('/create', function(req, res) {
  console.log("req.body: %j", req.body);
  storage.findOneUserBy({
    email : req.body.email.toLowerCase()
  }, function(error, user) {
    if (user) {
      console.log("user found: %j", user);
      smtpTransport.sendMail({
        from : "La palabra del día <palabra@erdtman.se>",
        to : user.email,
        subject : "Account",
        text : util.format("Welcome to La palabra del día this is your account link http://lapalabradeldia.herokuapp.com/%s", user._id)
      }, function(error, response) {
        if (error) {
          console.log(error);
          req.flash("error", "Failed to send email.");
        } else {
          console.log("Message sent: " + response.message);
          req.flash("info", "An email has been sent with a link to the account.");
        }
        return res.redirect("/");
      });
    } else {
      console.log("user not found create");
      storage.saveUser({
        _id : shortId.generate(),
        email : req.body.email.toLowerCase(),
        created : new Date()
      }, function(error, user) {
        console.log("user created, %j", user);
        smtpTransport.sendMail({
          from : "La palabra del día <palabra@erdtman.se>",
          to : user.email,
          subject : "Account",
          text : util.format("http://lapalabradeldia.herokuapp.com/%s", user._id)
        }, function(error, response) {
          if (error) {
            console.log(error);
          } else {
            console.log("Message sent: " + response.message);
          }
        });
        req.flash("success", "Account created, en email has been sent with a link to your account you can use it or");
        res.redirect("/" + user._id);
      });
    }
  });

});

app.get('/:id', function(req, res) {
  storage.findOneUserBy({
    _id : req.params.id
  }, function(error, user) {
    console.log(error);
    console.log(user);
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }
    res.render('start_internal.jade', {
      user : user,
      flash : req.flash()
    });
  });
});

app.get('/:id/add', function(req, res) {
  storage.findOneUserBy({
    _id : req.params.id
  }, function(error, user) {
    console.log(error);
    console.log(user);
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    res.render('add_word.jade', {
      user : user,
      flash : req.flash()
    });
  });
});

app.post('/:id/add', function(req, res) {
  storage.findOneUserBy({
    _id : req.params.id
  }, function(error, user) {

    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }
    storage.saveWord({
      _id : shortId.generate(),
      word : req.body.word.toLowerCase(),
      translation : req.body.translation.toLowerCase(),
      owner : req.params.id,
      created : new Date,
      tests : 0
    }, function(error, word) {
      console.log(word);
      req.flash("success", "'" + word.word + "' has been added");
      res.redirect("/" + req.params.id + "/add");
    });
  });
});

app.get('/:id/unknown', function(req, res) {

  storage.findOneUserBy({
    _id : req.params.id
  }, function(error, user) {

    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    storage.findAllWordsBy({
      owner : user._id,
      tests : {
        $lte : 16
      }
    }, function(error, words) {
      console.log("words: %j", words);
      res.render('list_unknown_words.jade', {
        user : user,
        words : words,
        flash : req.flash()
      });
    });
  });
});

app.get('/:id/known', function(req, res) {

  storage.findOneUserBy({
    _id : req.params.id
  }, function(error, user) {
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    storage.findAllWordsBy({
      owner : user._id,
      tests : {
        $gt : 16
      }
    }, function(error, words) {
      console.log("known words: %j", words);
      res.render('list_known.jade', {
        user : user,
        words : words,
        flash : req.flash()
      });
    });
  });
});

app.get('/:id/settings', function(req, res) {
  storage.findOneUserBy({
    _id : req.params.id
  }, function(error, user) {
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    res.render('settings.jade', {
      user : user,
      flash : req.flash()
    });
  });
});

app.post('/:id/settings', function(req, res) {
  storage.findOneUserBy({
    _id : req.params.id
  }, function(error, user) {
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    user.email = req.body.email.toLowerCase();
    user.pushover_id = req.body.pushover_id;
    user.words_per_day = parseInt(req.body.words_per_day);
    console.log(user);
    storage.updateUser(user, function(error, updatedUser) {
      req.flash("success", "Settigs has been saved!");
      return res.redirect("/" + user._id + "/settings");
    });
  });
});

app.post('/:id/delete/:word_id', function(req, res) {
  storage.findOneUserBy({
    _id : req.params.id
  }, function(error, user) {
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    console.log(user);
    console.log(req.params);
    storage.deleteWord({
      _id : req.params.word_id,
      owner : req.params.id
    }, function(error, deltedWord) {
      req.flash("success", "Word has been deleted.");
      return res.redirect(req.headers.referer ? req.headers.referer : "/" + user._id);
    });
  });
});

app.get('/:id/:word_id', function(req, res) {
  storage.findOneUserBy({
    _id : req.params.id
  }, function(error, user) {
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    storage.findOneWordBy({
      _id : req.params.word_id,
      owner : req.params.id
    }, function(error, word) {
      res.render('question.jade', {
        user : user,
        word : word,
        flash : req.flash()
      });
    });
  });
});

app.post('/:id/:word_id', function(req, res) {
  storage.findOneUserBy({
    _id : req.params.id
  }, function(error, user) {
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    storage.findOneWordBy({
      _id : req.params.word_id,
      owner : req.params.id
    }, function(error, word) {
      res.render('answer.jade', {
        user : user,
        word : word,
        sugestion : req.body.translation.toLowerCase(),
        correct : (word.translation === req.body.translation.toLowerCase()),
        flash : req.flash()
      });

      if (word.translation === req.body.translation.toLowerCase()) {
        word.tests++;
        storage.updateWord(word, function(error, updatedWord) {
        });
      }
    });
  });
});

var timer = function() {
  var counter = 0;
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
        message : util.format("http://lapalabradeldia.herokuapp.com/%s/%s", user._id, word._id),
        title : util.format("The word '%s'. ", word.word),
      }, function(error, result) {
        console.log("error: %j", error);
        console.log("result: %j", result);
      });

    });
  };

  return function() {
    counter = (counter) % 4 + 1;
    console.log("Sending %d", counter);
    storage.findAllUsersBy({
      words_per_day : {
        $gte : counter
      }
    }, function(error, users) {
      for ( var i = 0; i < users.length; i++) {
        console.log("sending to: %s", users[i].email);
        sendTo(users[i]);
      }
    });
  };
};

setTimeout(timer(), 10000);

setInterval(timer, 21600000);

var server = app.listen(port, function() {
  logger.info("Listening on %d", port);
});
