const mongoose = require('mongoose');

const chatConversationSchema = new mongoose.Schema({
  user1_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  user2_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  last_message: {
    type: String,
    default: null
  },
  last_message_at: {
    type: Date,
    default: null
  },
  is_deleted: {
    type: Boolean,
    default: false
  },
}, {
  timestamps: true
});

// Đảm bảo mỗi cặp người dùng chỉ có một cuộc trò chuyện
chatConversationSchema.index(
  { user1_id: 1, user2_id: 1 }, { unique: true }
);

module.exports = mongoose.model('chatConversation', chatConversationSchema);