const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'student',
    required: true
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'assignment',
    required: true
  },
  grade_score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  feedback: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Đảm bảo mỗi sinh viên chỉ có một điểm cho mỗi bài tập
gradeSchema.index({ student: 1, assignment: 1 }, { unique: true });

module.exports = mongoose.model('grade', gradeSchema);