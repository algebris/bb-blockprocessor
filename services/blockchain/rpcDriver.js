const _ = require('lodash');
const bunyan = require('bunyan');
const Promise = require('bluebird');
const log = bunyan.createLogger({name: 'utils.rpcDriver'});
const RpcClient = require('bitcoin-core');
const cfg = require(`${APP_DIR}/config`);

class RpcDriver {
  constructor(opts) {
    opts = opts || cfg.rpc || (log.error('Config setup error') && process.exit(1));
    this.instance = new RpcClient(opts);
  }

  async blockCount() {
    return Promise.resolve(this.instance.getBlockCount()).timeout(5000);
  }

  blockHashById(id) {
    id = parseInt(id, 10);
    return Promise.resolve(this.instance.command('getblockhash', id)).timeout(5000);
  }

  async blockByHash(hash) {
    const prep = this.instance.requester.prepare({method: 'getblock', parameters: [hash, true]});
    // console.time('blockByHash');
    const req = await this.instance.request.postAsync({
      auth: this.instance.auth,
      body: JSON.stringify(prep),
      url: '/'
    }).timeout(5000);
    // console.timeEnd('blockByHash');
    const data = JSON.parse(req[1]);
    return data.result;
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