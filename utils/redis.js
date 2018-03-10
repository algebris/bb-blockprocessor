const Promise = require('bluebird');
const redis = require('redis');
const config = require('../config');

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

const client = redis.createClient();

client.on('error', function error(err) {
  console.log('Redis error', err);
});

client.on('reconnecting', function reconnecting() {
  console.log('Redis Connection reestablished');
});

client.on('connect', function connect() {
  console.log('Redis connecting');
});

client.on('ready', function ready() {
  console.log('Redis client ready');
});

module.exports.client = client;
