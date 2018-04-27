global.APP_DIR = __dirname;
global.SRV_DIR = `${APP_DIR}/services`;

const _ = require('lodash');
const Promise = require('bluebird');
const bunyan = require('bunyan');

const cfg = require(`${APP_DIR}/config`);
const log = bunyan.createLogger({name: 'core.blockProcessor'});
const blockProcessService = require(`${SRV_DIR}/blockProcessService`);
const db = require(`${SRV_DIR}/database`).redis;

log.level(0);
log.info('Login level:', log.level());

const init = async () => {
  let lastBlockHeight = 0;
  let currentBlock = await db.getCurrentBlock();
  currentBlock = parseInt(currentBlock, 10) || 0;
  currentBlock++;
  log.info(`Search from block ${currentBlock} for network:${cfg.network}`);

  const processBlock = async () => {
    try {
      await Promise.resolve(blockProcessService.run(currentBlock)).timeout(20000);
      
      // if(currentBlock > 1634584) process.exit(0);

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
      if (err.code == 1 && err.block) {
        currentBlock = err.block++;
        log.info('Connecting from', currentBlock);
        return processBlock()
      }

      currentBlock++;
      processBlock();  
    }
  };

  processBlock();
};

module.export = init();
