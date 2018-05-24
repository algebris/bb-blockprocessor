const _ = require('lodash');
const db = require(`${SRV_DIR}/database`).redis;
const cfg = require(`${APP_DIR}/config`);
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.reorganisation'});
const BlockChain = require(`${SRV_DIR}/blockchain`)[cfg.bcDriver];
const bc = new BlockChain();
const TxLogModel = require(`${APP_DIR}/models/txLogModel`);
const UtxoLogModel = require(`${APP_DIR}/models/utxoLogModel`);

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

const restoreUtxo = async (utxos, txid, height) => {
  for(const utxo of utxos) {
    if(_.isArray(utxo.utxoIn))
      for(const vin of utxo.utxoIn) {
        const utxoObj = {txid, height, n:vin.n, time:vin.time, addr: vin.addr, val:vin.val};
        const res1 = await db.client.pipeline()
          .hmset(`utxo:${vin.txid}`, _.assign(utxoObj, {json: JSON.stringify(utxoObj)}))
          .rpush(`addr.utxo:${vin.addr}`, `${vin.txid}`)
          .exec();
        console.log('Created utxos', res1);
      }
    if(_.isArray(utxo.utxoOut))
      for(const vin of utxo.utxoOut) {
        console.log(`Delete utxo:${txid}:${vin.n}, addr.utxo:${vin.addr}`);
        const res2 = await db.client.pipeline()
          .del(`utxo:${txid}:${vin.n}`)
          .lrem(`addr.utxo:${vin.addr}`, 0, `${txid}:${vin.n}`)
          .exec();
        console.log('Removed utxos', res2);
      } 
  }
};

const detachBlocks = async from => {
  let blocksFrom = await db.client.zrangebyscore('block-chain', from, '+inf');
  const firstBlock = blocksFrom.shift();
  
  log.info(`Disconnecting ${blocksFrom.length} blocks`);
  
  for(const blkHash of blocksFrom.reverse()) {
    const score = await db.client.zscore('block-chain', blkHash);
    const data  = await TxLogModel.find({height:score}).sort({created: 'desc'});

    for(const txlog of data) {
      if(txlog.val === 0) continue;
      if(txlog.type === 'vin' && txlog.addr === 'coinbase') {
        const balance = await db.client.hincrby('coinbase', 'sent', -txlog.val);
        console.log('Decrease coinbase balance',balance);
        continue;
      }
      if(txlog.data) {
        const obj = {
          sent: txlog.data._sent,
          received: txlog.data._received,
          staked: txlog.data._staked,
          balance: txlog.data._balance
        };
        const balance = await db.client.hmset(`addr:${txlog.addr}`, obj);
        console.log('Updated balance', balance);

        const u = await UtxoLogModel.find({txid:txlog.txid});
        if(u.length > 0) 
          await restoreUtxo(u, txlog.txid, score);
      }
    }
    const res1 = await UtxoLogModel.remove({height:score});
    console.log('Remove UtxoLog', res1);
    const res2 = await TxLogModel.remove({height:score});
    console.log('Remove TxLog', res2);
    const res3 = await db.client.zrem('block-chain', blkHash);
    console.log('Remove from block-chain', res3);
  }
};

module.exports = {
  seekOutdatedBlocks,
  detachBlocks
};