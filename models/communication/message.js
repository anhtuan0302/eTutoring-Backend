const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'chatConversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  is_read: {
    type: Boolean,
    default: false
  },
  read_at: {
    type: Date
  },
  is_deleted_by_user1: {
    type: Boolean,
    default: false
  },
  is_deleted_by_user2: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('message', messageSchema);