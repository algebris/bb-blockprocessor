const _ = require('lodash');
const Promise = require('bluebird');
// const cfg = require('../config');
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.blockProcessor'});
// const {inspect} = require('../utils');
const client = require('../utils/client');
const Block = require('../utils/block');
const db = require('../utils/redis');
const Decimal = require('decimal.js');

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
  
  const getUtxoName  = (txid, slot) => `utxo:${txid}:${slot}`;

  const processIns = async tx => {
    return Promise.each(tx.vin, async $in => {
      if($in.txid && _.has($in, 'vout')) {
        const utxoName = getUtxoName($in.txid, $in.vout);
        const fout = await db.getObj(utxoName);
        
        if(fout) {
          const walletBalance = await db.get(`addr:bal:${fout.addr}`);
          const value = new Decimal(walletBalance);
          
          log.warn('FINP >', value.valueOf(), fout.val);

          return Promise.all([
            db.delUtxo(utxoName),
            db.set(`addr:bal:${fout.addr}`, value.sub(fout.val).valueOf())
          ]);
          // db.spendTxAddr(fout.addr, $in.txid);
        } else {
          log.warn(`DB missed TX [currentBlock=${currentBlock}, txId=${utxoName}]`);
        }
      } else {
        return Promise.resolve([]);
      }
    }).then(res => log.warn('INS >',res));
  };

  const processOuts = async tx => {
    return Promise.map(tx.vout, async $out => {
      let addr = _.get($out, 'scriptPubKey.addresses');
      
      if(!addr) {
        log.warn('Empty OUTPUT', $out);
        return Promise.resolve([]);
      }
      if(addr.length > 1) 
        log.warn('Found multiple addresses in OUT array [txid, txOut]', tx.txid, $out);
      
      addr = addr[0];

      if($out.value === 0) {
        // log.warn('Empty output to ', addr);
        return Promise.resolve(1);
      }

      let balance = await db.get(`addr:bal:${addr}`) || 0;
      balance = new Decimal(balance);
      balance = balance.add($out.value);

      log.warn('VALUE-OUT', $out.value, balance.valueOf());
      return Promise.all([
        db.set(getUtxoName(tx.txid, $out.n), {addr, val: $out.value}),
        db.set(`addr:bal:${addr}`, balance.valueOf()),
        // db.pushTxAddr(`addr:utxs:${addr}`, tx.txid, {val: $out.value})
      ]);
    }).then(res => log.warn('OUTS >',res));
  };

  const process = async () => {
    return Promise.each(txs, async tx => {
      log.info('processing tx#', tx.txid);
      await processIns(tx);
      await processOuts(tx);
    });
  };

  return process();
};
