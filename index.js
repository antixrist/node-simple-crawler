var Request = require('request'),
    Encoding = require('encoding'),
    Charset = require('charset'),
    Jschardet = require('jschardet'),
    Extend = require('extend'),
    Url = require('url'),
    _ = require('lodash'),
    Cheerio = require('cheerio'),

    Document = require('./lib/document');

var callbackDefault = function (err) {
  if (err) { throw err; }
};

var _defaults = {
  concurrent: 5,
  logs: true,
  request: {
    encoding: 'binary'
  },
  decodeTo: 'utf8',
  decodeFrom: ''
};

function Crawler(_options, callback) {
  this._defaults = _defaults;
  this.options = this._defaults;
  this.options = this._getOptions(_options);

  this.callback = (_.isFunction(callback)) ? callback : callbackDefault;

  this.pending = [];
  this.active = [];
  this.visited = [];
}

Crawler.prototype = {
  constructor: Crawler,

  queue: function(url, options, callback) {
    var err = false;
    var args = _.toArray(arguments);

    if (typeof arguments[0] != 'undefined' && arguments[0]) {
      url = arguments[0];
      if (_.isPlainObject(url)) {
        url = Url.format(url);
      }
    } else {
      err = new TypeError('Parameter "url" must be defined');
    }

    if (typeof args[1] != 'undefined' && arguments[1]) {
      if (_.isFunction(args[1])) {
        callback = args[1];
        options = {};
      } else if (_.isPlainObject(arguments[1])) {
        options = args[1];
      } else {
        options = {};
      }
    } else {
      options = {};
    }

    if (typeof args[2] != 'undefined' && args[2]) {
      if (_.isFunction(args[2])) {
        callback = args[2];
      } else {
        callback = callbackDefault;
      }
    } else if (!callback) {
      callback = callbackDefault;
    }

    if (err) {
      return callback(err);
    }

    if (this._stackIsFull()) {
      this._log('Queueing', url);
      this.pending.push({
        url: url,
        options: options,
        callback: callback
      });
    } else {
      this._load(url, options, callback);
    }
  },

  clearQueue: function () {
    this.pending = [];
  },

  resolve: function (base, url) {
    return Url.resolve(base, url);
  },

  _getOptions: function (_options) {
    return Extend(true, {}, this.options, _options || {});
  },

  _load: function(url, options, callback) {
    this._log('Loading', url);
    this.active.push(url);

    options = this._getOptions(options);

    Request(Extend(options.request, {url: url}), (function (context, url) {
      return function(err, response, body) {
        var document;
        if (err) {
          this._log('Error', url);
          return callback(err, url);
        } else {
          response.body = this._convert(response, body);
          document = new Document(url, response);
          process.nextTick(function () {
            callback(null, url, document);
          });
          this._loadFinished(url);
        }
      }.bind(context);
    })(this, url));
  },

  _convert: function (response, body) {
    var bodyBufConverted, decodeFrom, decodeTo, bodyBuffer;
    var data = response.body || '';

    if (data && this.options.decodeTo && this.options.request.encoding && this.options.request.encoding == 'binary') {
      decodeTo = this.options.decodeTo;
      decodeFrom = this.options.decodeFrom;
      bodyBuffer = new Buffer(body, 'binary');

      if (!decodeFrom) {
        decodeFrom = Charset(response.headers, bodyBuffer) || Jschardet.detect(body).encoding.toLowerCase();
      }

      bodyBufConverted = Encoding.convert(bodyBuffer, decodeTo, decodeFrom);
      data = bodyBufConverted.toString();
    }

    return data;
  },

  _loadFinished: function(url) {
    this._log('Success', url);
    this.visited.push(url);
    var i = this.active.indexOf(url);
    this.active.splice(i, 1);

    if (!this._stackIsFull()) {
      this._dequeue();
    }
  },

  _stackIsFull: function () {
    return this.active.length >= this.options.concurrent;
  },

  _dequeue: function() {
    var next = this.pending.shift();
    var callback = this.callback;
    var visited = this.visited;
    if (next) {
      this._load(next.url, next.options, next.callback);
    } else if (this.active.length === 0) {
      process.nextTick(function () {
        callback(null, visited);
      });
    }
  },

  _log: function(status, url) {
    if (this.options.logs) {
      console.log('>>>', status, url);
    }
  }

};

module.exports = Crawler;
