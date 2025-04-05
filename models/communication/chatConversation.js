const mongoose = require('mongoose');

const chatConversationSchema = new mongoose.Schema({
  _id: {
    type: String, // Firebase conversation ID
    required: true
  },
  user1_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  user2_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('chatConversation', chatConversationSchema);