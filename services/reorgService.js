const _ = require('lodash');
const db = require(`${SRV_DIR}/database`).redis;
const cfg = require(`${APP_DIR}/config`);
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.reorganisation'});
const txService = require(`${SRV_DIR}/txProcessService`);
const BlockChain = require(`${SRV_DIR}/blockchain`)[cfg.bcDriver];
const bc = new BlockChain();

const inspect = require(`${APP_DIR}/utils`).inspect;

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

////////////////////
const convertToSatoshi = val => parseInt(parseFloat(val).toFixed(8).toString().replace('.', ''));
const hasValidOuts = val => ['nonstandard', 'nulldata'].indexOf(val.type) == -1;
const groupByAddr = arr => _.chain(arr)
  .groupBy('addr')
  .map((group, key) => ({addr: key, val: _.sumBy(group, 'val')}))
  .value();
const SHOULD_UPDATE = 0;
const REORG_UPDATE = 1;
const SHOULDNT_UPDATE = 2;

const processIns = async (tx, height, shouldUpdate) => {
  let result = [];
  const summarize = (result, out) => _.add(result, out.val);
  for (const vin of tx.vin) {
    if (vin.addr == 'coinbase') {
      const val = _.chain(tx.vout)
        .filter(hasValidOuts)
        .reduce(summarize, 0)
        .value();
      result.push({addr: 'coinbase', val});
    } else {
      let out = await db.client.hget(`tx:${vin.id}`, 'json');
      if(out !== null) {
        out = JSON.parse(out);
        out = _.find(out.vout, {n:vin.n});
      }
      let obj = _.pick(out, ['addr', 'val']);
      log.info(`INPUT removing utxo utxo:${vin.id}:${vin.n}`)
      await db.client.pipeline()
        .hmset(`utxo:${vin.id}:${vin.n}`, _.assign(obj, {json: JSON.stringify(obj)}))
        .rpush(`addr.utxo:${out.addr}`, `${vin.id}:${vin.n}`)
        .exec()

      result.push(obj);
    }
  }
  // console.log({result});
  return groupByAddr(result);
};

/**
 * Processing OUTS
 * @param {array} tx Transaction's object
 * @param {array} vin Processed input object
 * @param {boolean} shouldUpdate
 */
const processOuts = async (tx, vin, shouldUpdate) => {
  let result = [];
  let nvin = Array.from(vin);
  let staked = false;

  for (const vout of tx.vout) {
    const pair = _.pick(vout, ['addr', 'val']) || {};
    if(hasValidOuts && _.keys(pair).length == 2) {
      if(shouldUpdate === REORG_UPDATE) {
        log.warn(`Removing from addr.utxo:${vout.addr}`, `${tx.txid}:${vout.n}`);
        log.warn(`Deleting utxo:${tx.txid}:${vout.n}`);
        await db.client.pipeline()
          .hdel(`utxo:${tx.txid}:${vout.n}`)
          .lrem(`addr.utxo:${vout.addr}`, 0, `${tx.txid}:${vout.n}`)
          .exec();
      }
      result.push(pair);
    }
    result = groupByAddr(result);
  }
  if(tx.vout[0].type == 'nonstandard' && result.length > 0 && nvin.length > 0 && nvin[0].addr == result[0].addr) {
    result[0].val -= nvin[0].val;
    nvin.shift();
    staked = true;
  }
  return {vout: result, nvin, staked};
};

const updateAddress = async args => {
  const {addr, val, type, txid, isStaked} = args;
  if (val === 0) return;
  if ( addr == 'coinbase' ) {
    return await db.client.hincrby('coinbase', 'sent', val);
  }
  let [sent, received, staked] = await db.client.hmget(`addr:${addr}`, ['sent', 'received', 'staked']);
  sent = parseInt(sent) || 0;
  received = parseInt(received) || 0;
  staked = parseInt(staked) || 0;

  if (type == 'vin' && !isStaked)
    sent += val;
  else if (type == 'vout' && !isStaked)
    received += val;
  else if (type == 'vout' && isStaked)
    staked += val;

  const balance = received + staked - sent;
  const result = {sent, received, staked, balance};

  log.info(`Updating addr:${addr}`, result);
  await db.client.hmset(`addr:${addr}`, result);
  
  if(type == 'vin') {
    await db.client.lrem(`addr.sent:${addr}`, 0, txid);
    log.info(`Remove from addr.sent:${addr}`, txid);
  }

  if(type == 'vout' && !isStaked) {
    log.info(`Remove from addr.received:${addr}`, txid);
    await db.client.lrem(`addr.received:${addr}`, 0, txid);
  }
  if(type == 'vout' && isStaked) {
    log.info(`Remove from addr.staked:${addr}`, txid);
    await db.client.lrem(`addr.staked:${addr}`, 0, txid);
  }
  return _.assign(result, {val});
};

//////////////

/**
 * Rebuild existing blockchain
 * @param {Array} newchain 
 */
const reindex = async from => {
  let blocksFrom = await db.client.zrangebyscore('block-chain', from, '+inf');
  const firstBlock = blocksFrom.shift();
  
  log.info(`Disconnecting ${blocksFrom.length} blocks`);
  for(const blkHash of blocksFrom.reverse()) {
    const blkTxs = await db.client.hget(`block:${blkHash}`, 'txs')
      .then(txs => JSON.parse(txs).reverse())
      .then(async txs => { // get list of transactions
        let txList = [];
        for (const txid of txs) {
          let t = await db.client.hget(`tx:${txid}`, 'json');
          txList.push(JSON.parse(t));
        }
        return txList;
      })
      .then(async txs => {
        for (const tx of txs) {
          const {vout, nvin, staked} = await processIns(tx, null, REORG_UPDATE)
            .then(vin => processOuts(tx, vin, REORG_UPDATE));

          for (const ni of nvin) {
            console.log({addr:ni.addr, val:-ni.val, txid: tx.txid, type:'vin'});
            await updateAddress({addr:ni.addr, val:-ni.val, txid: tx.txid, type:'vin'});
          }
          for (const vo of vout) {
            console.log({addr: vo.addr, val:-vo.val, txid: tx.txid, type: 'vout', isStaked:staked});
            await updateAddress({addr: vo.addr, val:-vo.val, txid: tx.txid, type: 'vout', isStaked:staked});
          }
          log.info(`Delete tx:${tx.txid}`);
          await db.client.del(`tx:${tx.txid}`);
        }
      });
    log.info(`Delete block:${blkHash}`);
    log.info(`Delete block-chain`, blkHash);
    await db.client.del(`block:${blkHash}`);
    await db.client.zrem('block-chain', blkHash);
  }
};

module.exports = {
  reindex,
  seekOutdatedBlocks
};