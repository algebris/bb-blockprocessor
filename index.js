const _ = require('lodash');
const Promise = require('bluebird');
const bunyan = require('bunyan');

const cfg = require('./config');
const log = bunyan.createLogger({name: 'core.blockProcessor'});
const blockProcessService = require('./services/blockProcessService');
const db = require('./utils/redis');

// const {inspect} = require('./utils');

// const bitcore = require('bitcore');
// const RpcClient = require('bitcoind-rpc');
// const client = require('bitcoind-rpc');

// const saveBlockHeight = currentBlock =>
//   blockModel.findOneAndUpdate({network: cfg.network}, {
//     $set: {
//       block: currentBlock,
//       created: Date.now()
//     }
//   }, {upsert: true});

const init = async () => {
  let lastBlockHeight = 0;
  let currentBlock = await db.getCurrentBlock() || 0;
  log.info(`Search from block ${currentBlock} for network:${cfg.network}`);
  
  const processBlock = async () => {
    try {
      log.info('Block#', currentBlock);
      let processed = await Promise.resolve(blockProcessService(currentBlock)).timeout(20000);
      // console.log(inspect(processed));

      // if (currentBlock > 6610) process.exit();
      // if (currentBlock == 102) currentBlock = 5450;
      await db.setCurrentBlock(currentBlock);
      
      currentBlock++;
      processBlock();  
    } catch(err) {
      if (err instanceof Promise.TimeoutError) {
        log.error('Timeout processing the block');
        return processBlock();
      }

      if (_.get(err, 'code') === 0) {
        if (lastBlockHeight !== currentBlock)
          log.info('Awaiting for next block');

        lastBlockHeight = currentBlock;
        return setTimeout(processBlock, 3000);
      }

      currentBlock++;
      processBlock();  
    }
  };

  processBlock();
};

module.export = init();
