const mongoose = require('mongoose');

const TxLog = new mongoose.Schema({
  created: {type: Date, required: true, default: Date.now},
  type: {type: String},
  height: {type: Number, index: true},
  txid: {type: String, index: true},
  addr: {type: String},
  balance: {type: Number},
  val: {type: Number},
  staked: {type: Boolean},
  data: {type: Object}
});

module.exports = mongoose.model('TxLog', TxLog);
