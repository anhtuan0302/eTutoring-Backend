const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  class_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classInfo',
    required: true
  },
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'student',
    required: true
  },
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String
    },
    review_at: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Đảm bảo mỗi sinh viên chỉ đăng ký một lớp một lần
enrollmentSchema.index({ class_id: 1, student_id: 1 }, { unique: true });

module.exports = mongoose.model('enrollment', enrollmentSchema);