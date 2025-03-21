const mongoose = require('mongoose');

const messageAttachmentSchema = new mongoose.Schema({
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'message',
    required: true
  },
  file_name: {
    type: String,
    required: true
  },
  file_type: {
    type: String,
    required: true
  },
  file_size: {
    type: Number,
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

module.exports = mongoose.model('messageAttachment', messageAttachmentSchema);