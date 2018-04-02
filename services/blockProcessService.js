const _ = require('lodash');
const Promise = require('bluebird');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.blockProcessor'});
const Block = require(`${SRV_DIR}/Block`);
const db = require(`${SRV_DIR}/database`).redis;
const cfg = require(`${APP_DIR}/config`);
const txService = require(`${SRV_DIR}/txProcessService`);

const BlockChain = require(`${SRV_DIR}/blockchain`)[cfg.bcDriver];
const bc = new BlockChain();

/**
 * Process transactions within block
 * @param {Promise>} txs 
 */
const processTxs = async txs => {
  for(const tx of txs) {
    log.info('Processing tx#', tx.txid);
    const vin = await txService.filterIns(tx);
    const {vout, nvin} = await txService.filterOuts(tx, vin);
    
    for (const ni of nvin) {
      await txService.updateAddress(ni.addr, ni.amount, 'vin');
    }
    for (const vo of vout) {
      await txService.updateAddress(vo.addr, vo.amount, 'vout');
    }
  }
};

/**
 * Reorganization blockchain
 * @param {*} blocks 
 */
const reorg = async blocks => {
  let hash_match = false;
  while(hash_match) {

  }
};

/**
 * Initial routine
 * @param {number} currentBlock
 */
const init = async (currentBlock) => {
  const blockHeight = await bc.blockCount();
  
  if (!blockHeight || blockHeight < currentBlock)
    return Promise.reject({code: 0});
  
  log.info('Block#', currentBlock);
  let block = new Block(currentBlock);
  await block.fetchBlockHeader();

  if (!block.hash)
    return Promise.reject({code: 0});
  
  let latestHash = await db.client.zrange('block-chain', -1, -1);
  latestHash = latestHash.shift() || 0;

  if(latestHash == 0 || latestHash === block.previousblockhash) {
    // update blockchain info
    await db.client.zadd('block-chain', currentBlock, block.hash);

    let blockMeta = { 
      height: parseInt(currentBlock, 10), 
      time: block.time,
      txs: block.tx,
      previousblockhash: block.previousblockhash
    };

    if (block.nextblockhash) 
      blockMeta.nextblockhash = block.nextblockhash;
    
    await db.client.hmset(`block:${block.hash}`, blockMeta);

    const txs = await block.fetchBlockTxs();

    if(txs && txs.length > 0) {
      return await processTxs(txs);
    }
  } else {
    log.warn('Reorg!');
    // const rank = await db.client.zrank('block-chain', block.hash);
    // if(rank == null) {
    //   return Promise.reject({code: 1});
    // } 
    // const reorgBlocks = await db.client.zrange('block-chain', -rank, -1);
    // console.log(`rank:${rank}, reorgBlocksSize:${reorgBlocks.length}`);
    // return reorg(reorgBlocks);
  }
};

module.exports = init;