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

  const processIns = async tx => {
    return _.transform(tx.vin, async (acc, $in) => {
      if($in.txid && $in.vout) {
        const result = await client.updateInRecord($in.txid, $in.vout);
        console.log('INS>', result);
      }
    });
  };

  const processOuts = async tx => {
    return _.transform(tx.vout, async (acc, $out) => {
      const addr = _.get($out, 'scriptPubKey.addresses');
      if(addr) {
        const result = await client.updateOutRecord(tx.txid, $out.n, addr, $out.value);
        console.log('OUTS>', result);
      }
    });
  };

  const process = async () => {
    return Promise.each(txs, async (tx, idx) => {
        console.log('processing tx#', tx.txid);
        const ins = await processIns(tx);
        const outs = await processOuts(tx);
        return {ins, outs};
      });
  }

  return await process();
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