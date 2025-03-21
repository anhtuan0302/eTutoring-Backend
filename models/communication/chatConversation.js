const mongoose = require('mongoose');

const chatConversationSchema = new mongoose.Schema({
  user1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  user2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
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

// Đảm bảo mỗi cặp người dùng chỉ có một cuộc trò chuyện
chatConversationSchema.index(
  { user1: 1, user2: 1 },
  { unique: true }
);

module.exports = mongoose.model('chatConversation', chatConversationSchema);