const _ = require('lodash');
const bunyan = require('bunyan');

const conf = {
  streams: [{ stream: process.stdout }]
};

module.exports = opts => bunyan.createLogger(_.assign(opts, conf));