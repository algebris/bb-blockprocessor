const _ = require('lodash');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'utils.client'});
const db = require(`${SRV_DIR}/database`).redis;
const RpcDriver = require('./rpcDriver');
const cfg = require(`${APP_DIR}/config`);

class RedisCacheDriver extends RpcDriver {
  constructor(opts) {
    super(opts);
  }
  blockCount() {
    super.blockCount();
  }
  blockHashById(id) {
    super.blockHashById(id);
  }
  blockByHash(hash) {
    super.blockByHash(hash);
  }
  async fetchTxs(txs) {
    super.fetchTxs(txs);
  }
}

module.exports = RedisCacheDriver;