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

const submissionSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'assignment',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'student',
    required: true
  },
  content: {
    type: String
  },
  attachments: [attachmentSchema],
  status: {
    type: String,
    enum: ['submitted', 'graded'],
    default: 'submitted'
  },
  submitted_at: {
    type: Date,
    default: Date.now
  },
  is_late: {
    type: Boolean,
    default: false
  },
  grade: {
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    feedback: {
      type: String,
    },
    grade_at: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Đảm bảo mỗi sinh viên chỉ nộp một bài cho mỗi assignment
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('submission', submissionSchema);