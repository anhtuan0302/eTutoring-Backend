const mongoose = require('mongoose');

const postReactionSchema = new mongoose.Schema({
  post_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'post',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  reaction_type: {
    type: String,
    enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
    required: true
  }
}, {
  timestamps: true
});

// Đảm bảo mỗi người dùng chỉ có một loại phản ứng cho mỗi bài viết
postReactionSchema.index({ post_id: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('postReaction', postReactionSchema);