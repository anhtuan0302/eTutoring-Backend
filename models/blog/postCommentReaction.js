const mongoose = require('mongoose');

const postCommentReactionSchema = new mongoose.Schema({
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'postComment',
    required: true
  },
  user: {
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

// Đảm bảo mỗi người dùng chỉ có một loại phản ứng cho mỗi bình luận
postCommentReactionSchema.index({ comment: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('postCommentReaction', postCommentReactionSchema);