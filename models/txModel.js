const mongoose = require('mongoose');

const Tx = new mongoose.Schema({
  created: {type: Date, required: true, default: Date.now},
  height: {type: Number},
  txid: {type: String, index: true, unique: true},
  data: {type: Object}
});

module.exports = mongoose.model('Tx', Tx);
