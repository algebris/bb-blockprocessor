const mongoose = require('mongoose');

const Accounts = new mongoose.Schema({
  account:
  {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Accounts', Accounts);