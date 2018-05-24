const mongoose = require('mongoose');

const Utxo = new mongoose.Schema({
  txid: {type: String},
  addr: {type: String},
  val: {type: Number},
  n: {type: Number},
  time: {type: Date},
});

const UtxoLog = new mongoose.Schema({
  created: {type: Date, required: true, default: Date.now},
  txid: {type: String, index: true},
  height: {type: Number, index: true},
  utxoIn: [Utxo],
  utxoOut: [Utxo]
});

module.exports = mongoose.model('UtxoLog', UtxoLog);
