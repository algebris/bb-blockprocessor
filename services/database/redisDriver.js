const _ = require('lodash');
const Promise = require('bluebird');
const Redis = require('ioredis');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'bp.redisDriver'});
const cfg = require(`${APP_DIR}/config`);

const client = new Redis(cfg.redisUrl);
let attempts = 0;

client.on('error', function error(err) {
  log.error('Redis error', err);
});

client.on('reconnecting', function reconnecting() {
  if(attempts == 5) process.exit();
  attempts++;
  log.info('Redis Connection reestablished');
});

client.on('connect', function connect() {
  log.info('Redis connecting');
});

client.on('ready', function ready() {
  log.info('Redis client ready');
  attempts = 0;
});

module.exports.getLatestBlock = async () => {
  let latestHash = await client.zrange('block-chain', -1, -1);
  const hash = latestHash.shift();
  if(hash) {
    const id = await client.zscore('block-chain', hash);
    return {id: parseInt(id, 10), hash};
  }
};

module.exports.setCurrentBlock = async (score, hash) => {
  return await client.zadd('block-chain', score, hash);
};

module.exports.getPrevBlockHash = async () => {
  const res = await client.zrange('block-chain', -1, -1);
  return res.shift();
}

module.exports.client = client;
