const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classInfo',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'student',
    required: true
  }
}, {
  timestamps: true
});

// Đảm bảo mỗi sinh viên chỉ đăng ký một lớp một lần
enrollmentSchema.index({ class: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('enrollment', enrollmentSchema);