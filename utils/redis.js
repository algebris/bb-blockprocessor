const _ = require('lodash');
const Promise = require('bluebird');
const redis = require('redis');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.blockProcessor'});
// const Decimal = require('decimal.js');
// const {inspect} = require('../utils');
// const config = require('../config');

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

const client = redis.createClient();

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

module.exports.get = async key => client.getAsync(key);

module.exports.getObj = async key => {
  let res = await client.getAsync(key);
  if(res === null) return res;
  try {
    res = JSON.parse(res);
  } catch(err) {
    log.warn('Error parsing object', typeof res, res);
  }
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
  return client.setAsync(key, val);
};

module.exports.updateBalance = (key, val) => client.setAsync(key, val);

module.exports.pushTxToAddr = (key, txid, obj) => {
  if(_.isObject(obj)) {
    try {
      obj = JSON.stringify(obj);
    } catch(err) {
      return Promise.resolve('Error stringify object -', obj);
    }
  }
  return client.hsetAsync(key, txid, obj);
};

module.exports.spendTxAddr = async (addr, txid) => {
  let utxObj;
  const utx = await client.hgetAsync(`addr:utxs:${addr}`, txid);
  if(!utx) return Promise.reject('UTXO key [tx] not found for address [addr]', txid, addr);

  try {
    utxObj = JSON.parse(utx);
  } catch(err) {
    return Promise.reject('Error parsing object', utxObj);
  }

  return Promise.all([
    client.hsetAsync(`addr:txs:${addr}`, utxo),
    client.hdelAsync(`addr:utxs:${addr}`)
  ]);
};

module.exports.delUtxo = key => {
  log.warn('Removing', key);
  return client.delAsync(key);
};

module.exports.getBalance = addr => client.getAsync(addr);

module.exports.client = client;
