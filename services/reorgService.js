const _ = require('lodash');
const db = require(`${SRV_DIR}/database`).redis;
const cfg = require(`${APP_DIR}/config`);
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.reorganisation'});
const BlockChain = require(`${SRV_DIR}/blockchain`)[cfg.bcDriver];
const bc = new BlockChain();
const TxLogModel = require(`${APP_DIR}/models/txLogModel`);

// const inspect = require(`${APP_DIR}/utils`).inspect;

/**
 * Reorganization blockchain chain recursive fn
 * @param {*} prevHash hash to start from
 * @param {*} ch array accumulator
 */
const seekOutdatedBlocks = async prevHash => {
  const block = await bc.blockByHash(prevHash);
  const found = await db.client.zscore('block-chain', block.hash);

  if(found === null) {
    return await seekOutdatedBlocks(block.previousblockhash);
  } else {
    return found;
  }
};

const detachBlocks = async from => {
  let blocksFrom = await db.client.zrangebyscore('block-chain', from, '+inf');
  const firstBlock = blocksFrom.shift();
  
  log.info(`Disconnecting ${blocksFrom.length} blocks`);
  
  for(const blkHash of blocksFrom.reverse()) {
    const score = await db.client.zscore('block-chain', blkHash);
    const data  = await TxLogModel.find({height:{$eq: score}}).sort({created: 'desc'});

    for(const txlog of data) {
      if(txlog.val === 0) continue;
      if(txlog.type === 'vin' && txlog.addr === 'coinbase') {
        //const balance = await db.client.hincrby('coinbase', 'sent', -txlog.val);
        //continue;
        console.log('coinbase.sent', -txlog.val);
      }
      if(txlog.data) {
        const obj = {
          sent: txlog.data._sent,
          received: txlog.data._received,
          staked: txlog.data._staked,
          balance: txlog.data._balance
        };
        // await db.client.hmset(`addr:${txlog.addr}`, obj);
        // await db.client.lrem(`addr.sent:${txlog.addr}`, 0, txlog.txid);
        // await db.client.lrem(`addr.received:${txlog.addr}`, 0, txlog.txid);
        // await db.client.lrem(`addr.staked:${txlog.addr}`, 0, txlog.txid);

      }
    }

  }
};

module.exports = {
  seekOutdatedBlocks,
  detachBlocks
};