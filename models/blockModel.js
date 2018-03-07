const mongoose = require('mongoose');

const BlockModel = new mongoose.Schema({
  network: String,
  block: Number
}, {
  timestamps: true
});

module.exports = mongoose.model('Block', BlockModel);