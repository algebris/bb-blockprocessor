const _ = require('lodash');
// const Promise = require('bluebird');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'utils.client'});
const cfg = require('../config');
const RpcClient = require('bitcoin-core');

class Client {
  constructor(opts) {
    opts = opts || cfg.rpc || (log.error('Config setup error') && process.exit(1));
    this.instance = new RpcClient(opts);
  }
  blockCount() {
    return this.instance.getBlockCount();
  }
  blockHashById(id) {
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
  // async updateInRecord(txid, vout) {

  //   return {txid, vout};
  // }
  // async updateOutRecord(txid, n, addr, value) {
  //   if(addr.length > 1) {
  //     console.error('Found multiple address', addr);
  //     process.exit(1);
  //   }
    
  //   return {txid, n, addr, value};
  // }

}

module.exports = new Client();