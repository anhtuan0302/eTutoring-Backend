const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  class_schedule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classSchedule',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'student',
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late'],
    default: 'absent'
  },
  note: {
    type: String
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
});

// Đảm bảo mỗi sinh viên chỉ có một bản ghi điểm danh cho mỗi lịch học
attendanceSchema.index({ class_schedule: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('attendance', attendanceSchema);