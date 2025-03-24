const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'chatConversation',
    required: true
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  content: {
    type: String
  },
  is_read: {
    type: Boolean,
    default: false
  },
  read_at: {
    type: Date
  },
  attachment: {
    file_name: String,
    file_type: String,
    file_path: String,
    file_size: Number
  },
  is_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

messageSchema.pre('save', function(next) {
  if (!this.content && !this.attachment) {
    next(new Error('Tin nhắn phải có nội dung hoặc file đính kèm'));
  }
  next();
});

messageSchema.index({ conversation_id: 1, createdAt: -1 });
messageSchema.index({ sender_id: 1, createdAt: -1 });

module.exports = mongoose.model('message', messageSchema);