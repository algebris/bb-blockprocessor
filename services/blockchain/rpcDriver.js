const _ = require('lodash');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'utils.client'});
const RpcClient = require('bitcoin-core');
const cfg = require(`${APP_DIR}/config`);

class RpcDriver {
  constructor(opts) {
    opts = opts || cfg.rpc || (log.error('Config setup error') && process.exit(1));
    this.instance = new RpcClient(opts);
  }
  blockCount() {
    return this.instance.getBlockCount();
  }
  blockHashById(id) {
    console.log('getblockhash-call:',id);
    return this.instance.command('getblockhash', id);
  }
  blockByHash(hash) {
    return this.instance.command('getblock', hash);
  }
  async fetchTxs(txs) {
    return await this.instance.command(this.batchTxs(txs));
  }
  batchTxs(txs) {
    return _.chain(txs)
      .map(tx => ({method: 'gettransaction', parameters: [tx]}))
      .value();
  }
}

module.exports = RpcDriver;