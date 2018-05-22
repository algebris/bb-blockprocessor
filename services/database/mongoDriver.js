const cfg = require(`${APP_DIR}/config`);
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.mongoDriver'});
const mongoose = require('mongoose');
mongoose.Promise = Promise;

mongoose.connection.on('disconnected', function () {
  log.error('Mongo disconnected!');
  process.exit(0);
});

module.exports = async () => 
  mongoose.connect(cfg.mongoUri, { keepAlive: true });

