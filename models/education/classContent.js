const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  file_name: {
    type: String,
    required: true
  },
  file_path: {
    type: String,
    required: true
  },
  file_type: {
    type: String,
    required: true,
    enum: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
  },
  file_size: {
    type: Number,
    required: true,
    max: 1024 * 1024 * 10
  }
});

const classContentSchema = new mongoose.Schema({
  classInfo_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classInfo',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  content_type: {
    type: String,
    enum: ['material', 'assignment'],
    required: true
  },
  duedate: {
    type: Date
  },
  attachments: [attachmentSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('classContent', classContentSchema);