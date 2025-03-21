const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  course: {
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
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  semester: {
    type: String,
    maxLength: 50
  },
  year: {
    type: Number
  },
  max_students: {
    type: Number
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'in_progress'],
    default: 'open'
  },
  start_date: {
    type: Date
  },
  end_date: {
    type: Date
  },
  is_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('classInfo', classSchema);