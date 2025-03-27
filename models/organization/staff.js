const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    unique: true
  },
  staff_code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  department_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'department',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('staff', staffSchema);