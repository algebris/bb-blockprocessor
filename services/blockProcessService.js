const _ = require('lodash');
const Promise = require('bluebird');
const cfg = require(`${APP_DIR}/config`);
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'bp.index'});
const db = require(`${SRV_DIR}/database`).redis;
const txService = require(`${SRV_DIR}/txProcessService`);
const reorgService = require(`${SRV_DIR}/reorgService`);
const TxModel = require(`${APP_DIR}/models/txModel`);
const TxLogModel = require(`${APP_DIR}/models/txLogModel`);
const UtxoLogModel = require(`${APP_DIR}/models/utxoLogModel`);

const BlockChain = require(`${SRV_DIR}/blockchain`)[cfg.bcDriver];
const bc = new BlockChain();

const processNextBlock = async () => {
  const height = this.blockHeight;

  for(let tx of this.block.tx) {
    log.info('Processing tx#', tx.txid);
    tx = txService.normalizeTx(tx);
    const {vout, nvin, staked, utxoIn, utxoOut} = await txService.processIns(tx, height, true)
      .then(ins => txService.processOuts(tx, ins, height, true));
      
    console.log({vout, nvin, staked, utxoIn, utxoOut});
    await UtxoLogModel.create({txid: tx.txid, height, utxoIn, utxoOut});
    
    for (const ni of nvin) {
      const data = await txService.updateAddress({addr: ni.addr, val: ni.val, txid: tx.txid, type: 'vin'});
      await TxLogModel.create({type: 'vin', addr: ni.addr, height, txid: tx.txid, balance: data.balance, val: ni.val, data});
    }
    for (const vo of vout) {
      const data = await txService.updateAddress({addr: vo.addr, val: vo.val, txid: tx.txid, type: 'vout', isStaked:staked});
      await TxLogModel.create({type: 'vout', height, addr: vo.addr, txid: tx.txid, balance: data.balance, val: vo.val, data, staked});
    }
  }
};

const run = async () => {
  const latestBlock = await db.getLatestBlock(); // get latest processed block from DB
  this.blockHeight = _.get(latestBlock, 'id', 0);  
  this.networkHeight = await bc.blockCount(); // get latest block from network

  // End of block-chain. Waiting for next block.
  if(this.blockHeight >= this.networkHeight) {
    return {code:1, block: this.blockHeight};
  }
  
  this.blockHeight++;
  this.blockHash = await bc.blockHashById(this.blockHeight); // get block hash by id
  this.block = await bc.blockByHash(this.blockHash); //get block data by hash
  this.prevHash = await db.getPrevBlockHash(); //get latest block hash from DB

  // Processing ordinary flow.
  if(!latestBlock || this.prevHash === this.block.previousblockhash) {
    log.info(`Processing block #${this.blockHeight}`);
    await processNextBlock.call(this);
    await db.setCurrentBlock(this.blockHeight, this.blockHash); // update Counter in DB
    return {code: 0, block: this.blockHeight};
  } else {
    // Reorganisation
    const fromHash = await reorgService.seekOutdatedBlocks(this.block.previousblockhash);
    const reorg = await reorgService.detachBlocks(fromHash);
    return {code: 2, block: this.block.height};
  }
  
};

module.exports = { 
  run 
};