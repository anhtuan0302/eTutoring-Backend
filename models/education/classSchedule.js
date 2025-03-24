const mongoose = require('mongoose');

const classScheduleSchema = new mongoose.Schema({
  class_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'classInfo',
    required: true
  },
  description: {
    type: String
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
    enum: ['scheduled', 'canceled', 'completed'],
    default: 'scheduled'
  }
}, {
  timestamps: true
});

classScheduleSchema.index({ class_id: 1, start_time: 1 });

module.exports = mongoose.model('classSchedule', classScheduleSchema);