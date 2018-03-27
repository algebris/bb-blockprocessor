require('dotenv').config();

module.exports = {
  network: process.env.NETWORK || 'mainnet',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379/0',
  rpc: {
    port: process.env.RPC_PORT || 8000,
    username: process.env.RPC_USER || '',
    password: process.env.RPC_PASSWD || '',
  }
};