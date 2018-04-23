const _ = require('lodash');
const db = require(`${SRV_DIR}/database`).redis;
const cfg = require(`${APP_DIR}/config`);
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.reorganisation'});
const txService = require(`${SRV_DIR}/txProcessService`);
const BlockChain = require(`${SRV_DIR}/blockchain`)[cfg.bcDriver];
const bc = new BlockChain();

/**
 * Reorganization blockchain chain recursive fn
 * @param {*} prevHash hash to start from
 * @param {*} ch array accumulator
 */
const searchConvergencePoint = async prevHash => {
  const block = await bc.blockByHash(prevHash);
  const found = await db.client.zscore('block-chain', block.hash);

  if(found === null) {
    console.log('rollback block #', bc.height);
    return await searchConvergencePoint(block.previousblockhash);
  } else {
    return found;
  }
};

/**
 * Rebuild existing blockchain
 * @param {Array} newchain 
 */
const reindex = async from => {
  let blocksFrom = await db.client.zrangebyscore('block-chain', from, '+inf');
  const firstBlock = blocksFrom.shift();

  for(const blkHash of blocksFrom.reverse()) {
    const blkTxs = await db.client.hget(`block:${blkHash}`, 'txs');
    const txList = JSON.parse(blkTxs).reverse();
  }
};

module.exports = {
  reindex,
  searchConvergencePoint
};