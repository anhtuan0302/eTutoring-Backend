const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  _id: {
    type: String, // Firebase post ID
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  moderated_info: {
    moderated_at: Date,
    moderated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user'
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('post', postSchema);