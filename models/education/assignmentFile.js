const mongoose = require('mongoose');

const assignmentFileSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'assignment',
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
  },
  is_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('assignmentFile', assignmentFileSchema);