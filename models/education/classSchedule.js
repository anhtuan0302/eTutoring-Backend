const mongoose = require('mongoose');

const classScheduleSchema = new mongoose.Schema({
  classInfo_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classInfo',
    required: true
  },
  start_time: {
    type: Date,
    required: true
  },
  end_time: {
    type: Date,
    required: true
  },
  is_online: {
    type: Boolean,
    default: false
  },
  online_link: {
    type: String
  },
  location: {
    type: String
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed'],
    default: 'scheduled'
  }
}, {
  timestamps: true
});

classScheduleSchema.index({ classInfo_id: 1, start_time: 1 });

module.exports = mongoose.model('classSchedule', classScheduleSchema);