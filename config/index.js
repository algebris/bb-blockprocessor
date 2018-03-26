require('dotenv').config();

module.exports = {
  network: process.env.NETWORK || 'mainnet',
  redis: {
    host: 'localhost',
    port: 6379
  },
  rpc: {
    port: process.env.RPC_PORT || 8000,
    username: process.env.RPC_USER || '',
    password: process.env.RPC_PASSWD || '',
  }
};