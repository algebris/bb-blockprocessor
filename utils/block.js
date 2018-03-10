const _ = require('lodash');
const client = require('./client');

class Block {
  constructor(block) {
    this.rawBlock = block;
    this.txs = [];
  }
  async fetchBlockTxs(txs) {
    const txArray = txs || this.rawBlock.tx;
    const result = await client.fetchTxs(txArray);
    if(!txs)
      this.txs = result;
    return result;
  }
}

module.exports = Block;
