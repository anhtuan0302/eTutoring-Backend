const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  _id: {
    type: String, // Firebase message ID
    required: true
  },
  conversation_id: {
    type: String, // Firebase conversation ID
    required: true
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('message', messageSchema);