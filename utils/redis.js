const _ = require('lodash');
const Promise = require('bluebird');
const Redis = require('ioredis');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.blockProcessor'});
// const config = require('../config');

const client = new Redis();

client.on('error', function error(err) {
  log.error('Redis error', err);
});

client.on('reconnecting', function reconnecting() {
  log.info('Redis Connection reestablished');
});

client.on('connect', function connect() {
  log.info('Redis connecting');
});

client.on('ready', function ready() {
  log.info('Redis client ready');
});

module.exports.get = async key => client.get(key);

module.exports.getObj = async key => {
  let res = await client.get(key);
  if(res === null) return res;
  try {
    res = JSON.parse(res);
  } catch(err) {
    log.warn('Error parsing object', typeof res, res);
  }
  log.warn('Getting Obj :', res);
  return res;
};

module.exports.set = (key, val) => {
  if(_.isObject(val)) {
    try {
      val = JSON.stringify(val);
    } catch(err) {
      return Promise.resolve('Error stringify object -', val);
    }
  }
  log.warn(`Setting ${key} = ${val}`);
  return client.set(key, val);
};

module.exports.updateBalance = (key, val) => client.set(key, val);

module.exports.delUtxo = key => {
  log.warn('Removing', key);
  return client.del(key);
};

module.exports.hincrby = (key, field, number) => client.hincrby(key, field, number);
module.exports.hexists = (key, field) => client.hexists(key, field);
module.exports.hset = (key, field, value) => client.hset(key, field, value);
module.exports.hsetnx = (key, field, value) => client.hsetnx(key, field, value);
/**
 *  Returns the values associated with the specified fields in the hash stored at key
 * @param {string} key 
 * @param {array} fields
 * @returns {Promise<array>}
 */
module.exports.hmget = (key, fields) => client.hmget(key, fields);
module.exports.hmset = (key, fields) => client.hmset(key, fields);

module.exports.sadd = (key, field) => client.sadd(key, field);
module.exports.srem = (key, field) => client.srem(key, field);

module.exports.hgetall = key => client.hgetall(key);
module.exports.getBalance = addr => client.get(addr);

module.exports.getCurrentBlock = () => client.get('current-block');
module.exports.setCurrentBlock = block => client.set('current-block', block);

module.exports.client = client;
