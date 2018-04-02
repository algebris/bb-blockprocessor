const _ = require('lodash');
const Promise = require('bluebird');
const Redis = require('ioredis');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.blockProcessor'});
const cfg = require(`${APP_DIR}/config`);

const client = new Redis(cfg.redisUrl);

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

/**
 *  Returns the values associated with the specified fields in the hash stored at key
 * @param {string} key 
 * @param {array} fields
 * @returns {Promise<array>}
 */

module.exports.getBalance = addr => client.get(addr);

module.exports.getCurrentBlock = async () => {
  let latestHash = await client.zrange('block-chain', -1, -1);
  const hash = latestHash.shift();
  if(hash) {
    const id = await client.zscore('block-chain', hash);
    return id;
  }
};

module.exports.setCurrentBlock = async (score, hash) => {
  const id = await client.zadd('block-chain', score, hash);
};

module.exports.client = client;
