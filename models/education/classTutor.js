const mongoose = require('mongoose');

const classTutorSchema = new mongoose.Schema({
  classInfo_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classInfo',
    required: true
  },
  tutor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'tutor',
    required: true
  },
  is_primary: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Đảm bảo mỗi giảng viên chỉ được phân công một vai trò (primary/non-primary) cho mỗi lớp
classTutorSchema.index({ classInfo_id: 1, tutor_id: 1 }, { unique: true });

module.exports = mongoose.model('classTutor', classTutorSchema);