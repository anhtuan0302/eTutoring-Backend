const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  ipaddress: {
    type: String
  },
  browser: {
    type: String
  },
  device: {
    type: String
  },
  os: {
    type: String
  },
  history_time: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('loginHistory', loginHistorySchema);