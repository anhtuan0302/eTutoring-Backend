const mongoose = require('mongoose');

const submissionFileSchema = new mongoose.Schema({
  submission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'submission',
    required: true
  },
  file_path: {
    type: String,
    required: true
  },
  file_name: {
    type: String,
    required: true
  },
  file_type: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('submissionFile', submissionFileSchema);