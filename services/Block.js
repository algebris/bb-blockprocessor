const _ = require('lodash');
const cfg = require(`${APP_DIR}/config`);
const blockchain = require(`${SRV_DIR}/blockchain`)[cfg.bcDriver];
const utils = require(`${APP_DIR}/utils`);
bc = new blockchain();

class Block {
  constructor(id) {
    this.height = id;
    this.tx = [];
  }
  
  async fetchBlockHeader() {
    if(!_.isNumber(parseInt(this.height)))
      throw new Error('Block Id is not defined or not number');

    const hash = await bc.blockHashById(this.height)
      .catch(err => err);

    const block = await bc.blockByHash(hash)
      .catch(err => err);
    
    if(!_.isEmpty(block))
      _.assign(this, block);
  }

  async fetchBlockTxs(txs) {
    const txArray = txs || this.tx;
    if(txArray.length == 0) return [];
    const result = await bc.fetchTxs(txArray);
    if(!txs)
      this._txs = result;
    return result;
  }
}

module.exports = Block;
