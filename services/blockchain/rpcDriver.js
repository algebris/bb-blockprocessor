const _ = require('lodash');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'utils.rpcDriver'});
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
    return this.instance.command('getblockhash', id);
  }
  async blockByHash(hash) {
    const prep = this.instance.requester.prepare({method: 'getblock', parameters: [hash, true]});
    const req = await this.instance.request.postAsync({
      auth: this.instance.auth,
      body: JSON.stringify(prep),
      url: '/'
    }).catch(err => log.error(err));
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