var Request = require('request'),
    Encoding = require('encoding'),
    Charset = require('charset'),
    Jschardet = require('jschardet'),
    Extend = require('extend'),
    Url = require('url'),
    _ = require('lodash'),
    Cheerio = require('cheerio');

var callbackDefault = function (err) {
  if (err) { throw err; }
};

var _defaults = {
  concurrent: 5,
  logs: true,
  request: {
    encoding: 'binary'
  },
  encodeTo: 'utf8',
  encodeFrom: ''
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

  _getOptions: function (_options) {
    return Extend(true, {}, this.options, _options || {});
  },

  _load: function(url, options, callback) {
    this._log('Loading', url);
    this.active.push(url);

    options = this._getOptions(options);

    Request(Extend(options.request, {url: url}), function(err, response, body) {
      var $;
      if (err) {
        this._log('Error', url);
        return callback.call(this, err, url);
      } else {
        response.body = this._convert(response, body);
        $ = Cheerio.load(response.body);
        callback.call(this, null, url, response, $);
        this._loadFinished(url);
      }
    }.bind(this));
  },

  _convert: function (response, body) {
    var bodyBufConverted, encodeFrom, encodeTo, bodyBuffer;
    var data = response.body || '';

    if (data && this.options.encodeTo && this.options.request.encoding && this.options.request.encoding == 'binary') {
      encodeTo = this.options.encodeTo;
      encodeFrom = this.options.encodeFrom;
      bodyBuffer = new Buffer(body, 'binary');

      if (!encodeFrom) {
        encodeFrom = Charset(response.headers, bodyBuffer) || Jschardet.detect(body).encoding.toLowerCase();
      }

      bodyBufConverted = Encoding.convert(bodyBuffer, encodeTo, encodeFrom);
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
    if (next) {
      this._load(next.url, next.options, next.callback);
    } else if (this.active.length === 0) {
      this.callback.call(this, null, this.visited);
    }
  },

  _log: function(status, url) {
    if (this.options.logs) {
      console.log('>>>', status, url);
    }
  }

};

module.exports = Crawler;
