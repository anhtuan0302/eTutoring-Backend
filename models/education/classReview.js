const mongoose = require('mongoose');

const classReviewSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classInfo',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'student',
    required: true
  },
  review_type: {
    type: String,
    enum: ['midterm', 'final'],
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String
  }
}, {
  timestamps: true
});

// Đảm bảo mỗi sinh viên chỉ đánh giá một lớp học một lần
classReviewSchema.index({ class: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('classReview', classReviewSchema);