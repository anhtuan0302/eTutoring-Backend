const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  token: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'token'
  },
  history_time: {
    type: Date,
    default: Date.now
  },
  ipaddress: {
    type: String
  },
  device: {
    type: String
  },
  browser: {
    type: String
  },
  os: {
    type: String
  }
});

module.exports = mongoose.model('loginHistory', loginHistorySchema);