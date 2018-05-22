const _ = require('lodash');
const db = require(`${SRV_DIR}/database`).redis;
const cfg = require(`${APP_DIR}/config`);
// const bunyan = require('bunyan');
// const log = bunyan.createLogger({name: 'core.reorganisation'});
// const log = require(`${APP_DIR}/utils/logging`)({name:'core.reorgService'});
// const txService = require(`${SRV_DIR}/txProcessService`);
const BlockChain = require(`${SRV_DIR}/blockchain`)[cfg.bcDriver];
const bc = new BlockChain();
// const TxModel = require(`${APP_DIR}/models/txModel`);

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

module.exports = {
  seekOutdatedBlocks
};