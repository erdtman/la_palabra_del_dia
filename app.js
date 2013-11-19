var express = require('express');
var flash = require('connect-flash');
var storage = require('./storage.js').storage;
var logger = require('./logger.js').logger;
var ObjectID = require('mongodb').ObjectID;
var util = require('util');

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
  app.use(express.cookieParser());
  app.use(express.session({
    secret : '498f99f3bbee4ae3a074bada02488464'
  }));
  app.use(flash());
  app.use(app.router);
  app.use("/static", express.static(__dirname + '/static'));
  app.use(express.errorHandler({
    showStack : false,
    dumpExceptions : false
  }));
});

app.get('/', function(req, res) {
  res.render('start.jade', {
    flash : flash()
  });
});

app.post('/create', function(req, res) {
  // TODO validate email
  console.log("req.body: %j", req.body);
  storage.findOneUserBy({
    email : req.body.email
  }, function(error, user) {
    if (user) {
      console.log("user found: %j", user);
      smtpTransport.sendMail({
        from : "La palabra del día <palabra@erdtman.se>",
        to : user.email,
        subject : "Account",
        text : util.format("http://localhost:5001/%s", user._id)
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
        email : req.body.email,
        created : new Date()
      }, function(error, user) {
        console.log("user created, %j", user);
        smtpTransport.sendMail({
          from : "La palabra del día <palabra@erdtman.se>",
          to : user.email,
          subject : "Account",
          text : util.format("http://localhost:5001/%s", user._id)
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
  try {
    ObjectID(req.params.id);
  } catch (e) {
    req.flash("error", "Unkonwn account!");
    return res.redirect("/");
  }

  storage.findOneUserBy({
    _id : ObjectID(req.params.id)
  }, function(error, user) {
    console.log(error);
    console.log(user);
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }
    res.render('start_internal.jade', {
      user : user,
      flash : flash()
    });
  });
});

app.get('/:id/add', function(req, res) {
  try {
    ObjectID(req.params.id);
  } catch (e) {
    req.flash("error", "Unkonwn account!");
    return res.redirect("/");
  }

  storage.findOneUserBy({
    _id : ObjectID(req.params.id)
  }, function(error, user) {
    console.log(error);
    console.log(user);
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    res.render('add_word.jade', {
      user : user,
      flash : flash()
    });
  });
});

app.post('/:id/add', function(req, res) {
  try {
    ObjectID(req.params.id);
  } catch (e) {
    req.flash("error", "Unkonwn account!");
    return res.redirect("/");
  }

  storage.findOneUserBy({
    _id : ObjectID(req.params.id)
  }, function(error, user) {

    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }
    storage.saveWord({
      word : req.body.word,
      translation : req.body.translation,
      owner : req.params.id,
      created : new Date,
      tests : 20
    }, function(error, word) {
      console.log(word);
      req.flash("error", "'" + word.word + "' has been added");
      res.redirect("/" + req.params.id);
    });
  });
});

app.get('/:id/unknown', function(req, res) {
  console.log("unknown");
  try {
    ObjectID(req.params.id);
  } catch (e) {
    req.flash("error", "Unkonwn account!");
    return res.redirect("/");
  }

  storage.findOneUserBy({
    _id : ObjectID(req.params.id)
  }, function(error, user) {

    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    storage.findAllWordsBy({
      owner : "" + user._id,
      tests : {
        $lte : 16
      }
    }, function(error, words) {
      console.log("words: %j", words);
      res.render('list_unknown_words.jade', {
        user : user,
        words : words,
        flash : flash()
      });
    });
  });
});

app.get('/:id/known', function(req, res) {
  try {
    ObjectID(req.params.id);
  } catch (e) {
    req.flash("error", "Unkonwn account!");
    return res.redirect("/");
  }

  storage.findOneUserBy({
    _id : ObjectID(req.params.id)
  }, function(error, user) {
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    storage.findAllWordsBy({
      owner : "" + user._id,
      tests : {
        $gt : 16
      }
    }, function(error, words) {
      console.log("known words: %j", words);
      res.render('list_known.jade', {
        user : user,
        words : words,
        flash : flash()
      });
    });
  });
});

app.get('/:id/settings', function(req, res) {
  try {
    ObjectID(req.params.id);
  } catch (e) {
    req.flash("error", "Unkonwn account!");
    return res.redirect("/");
  }

  storage.findOneUserBy({
    _id : ObjectID(req.params.id)
  }, function(error, user) {
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    res.render('settings.jade', {
      user : user,
      flash : flash()
    });
  });
});

app.post('/:id/settings', function(req, res) {
  try {
    ObjectID(req.params.id);
  } catch (e) {
    req.flash("error", "Unkonwn account!");
    return res.redirect("/");
  }

  storage.findOneUserBy({
    _id : ObjectID(req.params.id)
  }, function(error, user) {
    if (!user) {
      req.flash("error", "Unkonwn account!");
      return res.redirect("/");
    }

    user.email = req.body.email;
    user.pushover_id = req.body.pushover_id;
    user.words_per_day = req.body.words_per_day;
    console.log(user);
    storage.updateUser(user, function(error, updatedUser) {
      req.flash("success", "Settigs has been saved!");
      return res.redirect("/" + user._id);
    });
  });
});

var server = app.listen(port, function() {
  logger.info("Listening on %d", port);
});
