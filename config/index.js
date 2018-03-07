require('dotenv').config();

module.exports = {
  network: process.env.NETWORK || 'mainnet',
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/bitbay'
  },
  rpc: {
    port: process.env.RPC_PORT || 8000,
    username: process.env.RPC_USER || '',
    password: process.env.RPC_PASSWD || '',
  }
};