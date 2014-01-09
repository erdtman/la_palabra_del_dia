exports.create = function(options) {
  // TODO start to use some options for 'force https' or 'force not http'
  return function(req, res, next) {
    var reqType = req.headers["x-forwarded-proto"];
    if (reqType == 'http') {
      res.redirect("https://" + req.headers.host + req.url);
    } else {
      next();
    }
  };
};