const _ = require('lodash');
const Promise = require('bluebird');
const cfg = require('../config');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.blockProcessor'});
const txsProcessService = require('./txsProcessService');
const {inspect} = require('../utils');
const client = require('../utils/client');
const Block = require('../utils/block');

module.exports = async (currentBlock) => {
  const blockHeight = await client.blockCount();
  
  if (!blockHeight || blockHeight <= currentBlock)
    return Promise.reject({code: 0});
  
  const blockHash = await client.blockHashById(currentBlock);
  const blockObj = await client.blockByHash(blockHash);

  if (!blockObj) 
    return Promise.reject({code: 0});
    
  const block = new Block(blockObj); 
  const txs = await block.fetchBlockTxs();

  async process() {
    return _.chain(this.txs)
      .each(tx => _.chain(tx)
        .processOuts()
        .processIns()
        .value()
      )
      .value();
  }

  return await block.process();
};


// const txIns() {
//   const zz = _.chain(this.txs)
//     .pick(['txid', 'vin', 'vout']).value();
//   console.log(zz);
//   return zz;
// }
// get txOuts() {
//   return _.chain(this.txs).pick(['txid', 'vout']).value();
// }

  // const insputs = _.chain(blockTxs)
  //   .map(txObj => tx.getTxIns(txObj))
  //   .remove(txIn => !_.has(txIn.vin[0], 'coinbase'))
  //   .value();
  
  //   const outputs = _.chain(blockTxs)
  //     .map(txObj => tx.getTxOuts(txObj))
  //     .value();

  // return outputs;


  // console.log(inspect(ins));
  // const obj = await processTxs(block.tx);