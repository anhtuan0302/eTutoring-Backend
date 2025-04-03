const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'course',
    required: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxLength: 100
  },
  max_students: {
    type: Number
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'in progress'],
    default: 'open'
  },
  start_date: {
    type: Date
  },
  end_date: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('classInfo', classSchema);