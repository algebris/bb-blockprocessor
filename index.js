const _ = require('lodash');
const Promise = require('bluebird');
const mongoose = require('mongoose');
const bunyan = require('bunyan');

const cfg = require('./config');
const redis = require('./utils/redis').client;
const log = bunyan.createLogger({name: 'core.blockProcessor'});
const blockModel = require('./models/blockModel');
const blockProcessService = require('./services/blockProcessService');

const {inspect} = require('./utils');

// const bitcore = require('bitcore');
// const RpcClient = require('bitcoind-rpc');
// const client = require('bitcoind-rpc');

mongoose.Promise = Promise;
mongoose.connect(cfg.mongo.uri);

mongoose.connection.on('disconnected', function () {
  log.error('Mongo disconnected!');
  process.exit(0);
});

const saveBlockHeight = currentBlock =>
  blockModel.findOneAndUpdate({network: cfg.network}, {
    $set: {
      block: currentBlock,
      created: Date.now()
    }
  }, {upsert: true});

const init = async () => {
  const FROM = 1573188;
  let currentBlock = await blockModel.findOne({network: cfg.network});
  currentBlock = _.chain(currentBlock).get('block', 0).add(0).value();
  currentBlock = FROM;
  log.info(`Search from block ${currentBlock} for network:${cfg.network}`);
  
  const processBlock = async () => {
    try {
      console.log('Block#', currentBlock);
      let processed = await Promise.resolve(blockProcessService(currentBlock)).timeout(20000);
      // console.log(inspect(processed));

      if (currentBlock >= FROM + 2) process.exit();
      
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
