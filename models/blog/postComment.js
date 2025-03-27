const mongoose = require('mongoose');

const postCommentSchema = new mongoose.Schema({
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
  content: {
    type: String,
    required: true,
    maxlength: 1000
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('postComment', postCommentSchema);