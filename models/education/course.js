const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxLength: 100
  },
  description: {
    type: String
  },
  course_category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'courseCategory',
    required: true
  },
  is_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('course', courseSchema);