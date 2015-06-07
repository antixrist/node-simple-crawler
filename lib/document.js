var Cheerio = require('cheerio'),
    Url = require('url');

var Document = function (url,  response) {
  this.response = response;
  this.url = url;
};

Document.prototype = {
  constructor: Document,

  get $() {
    return this.$ = Cheerio.load(this.response.body);
  },

  resolve: function(uri) {
    return Url.resolve(this.url, uri);
  }
};

module.exports = Document;