const _ = require('lodash');
const Promise = require('bluebird');
const cfg = require('../config');
const RpcClient = require('bitcoin-core');
const client = new RpcClient(cfg.rpc);
const txsProcessService = require('./txsProcessService');
const {keyPress} = require('../utils');

module.exports = async (currentBlock) => {
  const blockHeight = await client.getBlockCount();
  
  if (!blockHeight || blockHeight <= currentBlock)
    return Promise.reject({code: 0});
  
  const blockHash = await client.command('getblockhash', currentBlock + 1);  
  const block = await client.command('getblock', blockHash);

  if (!block)
    return Promise.reject({code: 0});

  if (!_.get(block, 'tx') || _.isEmpty(block.tx)) {
    return Promise.reject({code: 2});
  }
  const v1 = await client.command('gettransaction', '9a65eba57128cfcbae44865dd77b6c74a0035731a5fa01f5ce5e0e41d324ec6e');
  const v2 = await client.command('gettransaction', 'a58df0ff6601ee8a539c21881ee38c0c505865a75358045e59f5f807a03494a9');
  
  console.log(v1, v2)
  keyPress();
  // const trans = _.map(block.tx, async tx => {
  //   return await client.getTransactionByHash(tx);
  // });

  // console.log(trans);
  process.exit();

  return await txsProcessService(block.tx);
};