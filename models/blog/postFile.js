const mongoose = require('mongoose');

const postFileSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'post',
    required: true
  },
  path: {
    type: String,
    required: true
  },
  is_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('postFile', postFileSchema);