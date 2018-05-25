global.APP_DIR = __dirname;
global.SRV_DIR = `${APP_DIR}/services`;

// const _ = require('lodash');
// const cfg = require(`${APP_DIR}/config`);
const Promise = require('bluebird');
const util = require('util');
const bunyan = require('bunyan');
const log = bunyan.createLogger({ name: 'bp.index' });
const blockProcessService = require(`${SRV_DIR}/blockProcessService`);
const mongo = require(`${SRV_DIR}/database`).mongo;
const db = require(`${SRV_DIR}/database`).redis;

const sleep = util.promisify(setTimeout);
// const inspect = obj => util.inspect(obj, { showHidden: true, depth: null });
let lastProcessedBlock;

const errorHandler = async err => {
  if(err instanceof Promise.TimeoutError) {
    log.info('Timeout Error')
    await sleep(3000);
    return processBlock();
  }
  log.error(err);
  await sleep(3000);
  return processBlock();
};

const resultHandler = async res => {
  if(res && res.code === 1) {
    if(lastProcessedBlock !== res.block) {
      log.info('Awaiting for next block');
    }
    await sleep(3000);
    lastProcessedBlock = res.block;
    processBlock();
  }
  if(res && res.code === 0) {
    log.info(res);
    // await sleep(3000);
    processBlock();
  }
  if(res.code === 2) {
    log.info('Reorg');
    processBlock();
  }
};

const processBlock = async () => {
  await blockProcessService.run()
    .then(resultHandler)
    .catch(errorHandler);
};

const run = async () => {
  await mongo();
  const latestBlock = await db.getLatestBlock();
  if(!latestBlock) {
    log.info(`Sync started`);
  } else {
    log.info(`Latest synced block = ${latestBlock.id}`);
  }
  processBlock();
};

module.export = run();
