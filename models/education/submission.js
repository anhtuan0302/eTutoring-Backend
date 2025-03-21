const mongoose = require('mongoose');

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
  }
}, {
  timestamps: true
});

// Đảm bảo mỗi sinh viên chỉ nộp một bài cho mỗi assignment
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('submission', submissionSchema);