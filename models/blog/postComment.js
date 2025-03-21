const mongoose = require('mongoose');

const postCommentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'post',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('postComment', postCommentSchema);