const _ = require('lodash');
const Promise = require('bluebird');
// const bunyan = require('bunyan');
// const log = bunyan.createLogger({name: 'core.blockProcessor'});
const log = require(`${APP_DIR}/utils/logging`)({name:'core.blockProcessor'});
const utils = require(`${APP_DIR}/utils`);
const Block = require(`${SRV_DIR}/Block`);
const db = require(`${SRV_DIR}/database`).redis;
const cfg = require(`${APP_DIR}/config`);
const txService = require(`${SRV_DIR}/txProcessService`);
const reorgService = require(`${SRV_DIR}/reorgService`);

const BlockChain = require(`${SRV_DIR}/blockchain`)[cfg.bcDriver];
const bc = new BlockChain();

/**
 * Process transactions within block
 * @param {array} txs transactions
 * @param {number} height current block
 * @returns {Promise<object>} processing result
 */

const processTxs = async (txs, height) => {
  let arr = [];
  for(let tx of txs) {
    log.info('Processing tx#', tx.txid);
    tx = txService.normalizeTx(tx);
    const {vout, nvin, staked} = await txService.processIns(tx, height, true)
      .then(ins => txService.processOuts(tx, ins, height, true));
    
    console.log({vout, nvin, staked});
    
    for (const ni of nvin) {
      const _nvin = await txService.updateAddress({addr: ni.addr, val: ni.val, txid: tx.txid, type: 'vin'});
      arr.push(_nvin);
    }
    for (const vo of vout) {
      const _vout = await txService.updateAddress({addr: vo.addr, val: vo.val, txid: tx.txid, type: 'vout', isStaked:staked});
      arr.push(_vout)
    }
    const obj = {id: tx.txid, time: tx.time, height, json: JSON.stringify(tx)};
    await db.client.hmset(`tx:${tx.txid}`, obj);
  }
  return arr;
};

/**
 * Initial block-processor routine
 * @param {number} currentBlock
 */
const run = async currentBlock => {
  currentBlock = parseInt(currentBlock, 10);
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
    let blockMeta = {
      height: parseInt(currentBlock, 10),
      time: block.time,
      txs: JSON.stringify(_.map(block.tx, 'txid')),
      previousblockhash: block.previousblockhash
    };

    if (block.nextblockhash)
      blockMeta.nextblockhash = block.nextblockhash;
    
    await db.client.pipeline()
      .zadd('block-chain', currentBlock, block.hash)
      .hmset(`block:${block.hash}`, blockMeta)
      .hset(`block:${block.previousblockhash}`, 'nextblockhash', block.hash)
      .exec();

    // await reorgService.updateBlockBuffer(block, pl);
    // const txs = await block.fetchBlockTxs();
    
    const txs = block.tx;
    if(txs && txs.length > 0) {
      const processed = await processTxs(txs, currentBlock).catch(err => log.error(err));
      console.log(utils.inspect(processed));
    }
  } else {
    log.warn('Reorg!');
    const point = await reorgService.seekOutdatedBlocks(block.previousblockhash).catch(err => log.error(err));
    const res = await reorgService.reindex(point).catch(err => log.error(err));
    return Promise.reject({code: 1, block: point});
  }
};

module.exports = {
  run
};