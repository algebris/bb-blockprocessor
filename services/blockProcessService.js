const _ = require('lodash');
const Promise = require('bluebird');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.blockProcessor'});
const client = require('../utils/client');
const Block = require('../utils/block');
const db = require('../utils/redis');

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
  
  const process = async (txs) => {
    for(const tx of txs) {
      log.info('Processing tx#', tx.txid);
      const vin = await filterIns(tx);
      const {vout, nvin} = await filterOuts(tx, vin);
      
      for (const ni of nvin) {
        await updateAddress(ni.addr, tx.txid, ni.amount, 'vin');
      }
      for (const vo of vout) {
        await updateAddress(vo.addr, tx.txid, vo.amount, 'vout');
      }
    }
  };

  const convertToSatoshi = amount => parseInt(parseFloat(amount).toFixed(8).toString().replace('.', ''));  
  const groupByAddr = arr => _.chain(arr)
    .groupBy('addr')
    .map((group, key) => ({addr: key, amount: _.sumBy(group, 'amount')}))
    .value();
  
  /**
   * Processing INS
   * @param {array} tx Transaction's object
   */
  const filterIns = async tx => {
    let arrVin = [];
    for (const vin of tx.vin) {
      if(vin.coinbase) {
        let amount = 0;
        // If coinbase input then return sum of all outputs
        tx.vout.forEach(vout => {
          const pk = vout.scriptPubKey;
          if (pk.type != 'nonstandard' && pk.type != 'nulldata') {
            amount += convertToSatoshi(vout.value);
            arrVin.push({addr: 'coinbase', amount});
          }
        });
      } else {
        let fout = await db.client.get(`utxo:${vin.txid}:${vin.vout}`);
        fout = JSON.parse(fout);

        if(fout) {
          await db.client.pipeline()
            .del(`utxo:${vin.txid}:${vin.vout}`)
            .hdel(`addr.utxo:${fout.addr}`, `${vin.txid}:${vin.vout}`)
            .exec();

          arrVin.push({addr: fout.addr, amount: fout.amount});
        } else {
          log.error(`DB missed TX [currentBlock=${currentBlock}, txId=utxo:${vin.txid}:${vin.vout}]`);
        }
      }
    }
    return groupByAddr(arrVin);
  };

  /**
   * Processing OUTS
   * @param {array} tx Transaction's object
   * @param {array} vin Processed input object
   */
  const filterOuts = async (tx, vin) => {
    let arrVout = [];
    let nvin = Array.from(vin);
    for (const vout of tx.vout) {
      const pk = vout.scriptPubKey;
      
      // Process valid output
      if (pk.type != 'nonstandard' && pk.type != 'nulldata') {
        const amount = convertToSatoshi(vout.value);
        const addr = pk.addresses[0];
        const obj = JSON.stringify({addr, amount, height: currentBlock});

        await db.client.pipeline()
          .set(`utxo:${tx.txid}:${vout.n}`, obj) // save Utxo
          .hset(`addr.utxo:${addr}`, `${tx.txid}:${vout.n}`, obj)
          .exec();
        
        arrVout.push({addr, amount});
      }
      // Group addresses and it's amounts
      arrVout = groupByAddr(arrVout);
    }
    // Calculate balance for PoS blocks 
    if(tx.vout[0].scriptPubKey.type == 'nonstandard' && arrVout.length > 0 && nvin.length > 0 && nvin[0].addr == arrVout[0].addr) {
      arrVout[0].amount -= nvin[0].amount;
      nvin.shift();
    }
    return {vout: arrVout, nvin};
  };

  /**
   * Update account's balances
   * @param {string} addr
   * @param {string} txid 
   * @param {number} amount 
   * @param {string} type 
   */
  const updateAddress = async (addr, txid, amount, type) => {
    if ( addr == 'coinbase' ) {
      return await db.hincrby('coinbase', 'sent', amount);
    }
    let [sent, received] = await db.hmget(`addr:${addr}`, ['sent', 'received']);
    sent = parseInt(sent) || 0;
    received = parseInt(received) || 0;

    if (type == 'vin') {
      sent += amount;
    } else {
      received += amount;
    }
    const balance = received - sent;

    // await db.hsetnx(`addr:${addr}`, `tx:${currentBlock}:${txid}:${type}`, JSON.stringify({amount}));
    await db.hmset(`addr:${addr}`, {sent, received, balance});
    // await db.hset('blocklog', `${currentBlock}:${blockHash}`, );
  };

  return process(txs);
};
