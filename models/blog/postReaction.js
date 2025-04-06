const mongoose = require('mongoose');

const postReactionSchema = new mongoose.Schema({
  _id: {
    type: String, // Firebase reaction ID
    required: true
  },
  post_id: {
    type: String, // Firebase post ID
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('postReaction', postReactionSchema);