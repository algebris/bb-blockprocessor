const _ = require('lodash');
const Promise = require('bluebird');
const bunyan = require('bunyan');

const cfg = require('./config');
const log = bunyan.createLogger({name: 'core.blockProcessor'});
const blockProcessService = require('./services/blockProcessService');
const db = require('./utils/redis');

// const {inspect} = require('./utils');
log.level(0);
log.info('Login level:', log.level());

const init = async () => {
  let lastBlockHeight = 0;
  let currentBlock = await db.getCurrentBlock() || 0;
  log.info(`Search from block ${currentBlock} for network:${cfg.network}`);
  
  const processBlock = async () => {
    try {
      await Promise.resolve(blockProcessService(currentBlock)).timeout(20000);
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
