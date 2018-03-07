const _
const bunyan = require('bunyan');
const log = bunyan.createLogger({name: 'core.blockProcessor'});

module.exports = (txs) => {
  // const result = _.chain(block.tx)
  // .map(async tx => {
  //   const trans = await client.command('gettransaction', tx);
  //   console.log('zzz', trans);
  //   return trans;
  // })
  // .value();
  
  const trans = await client.command('gettransaction', 'a58df0ff6601ee8a539c21881ee38c0c505865a75358045e59f5f807a03494a9');
  console.log(trans);

  process.exit();
};