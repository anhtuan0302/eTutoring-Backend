const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  _id: {
    type: String, // Firebase notification ID
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  notification_type: {
    type: String,
    required: true,
    enum: ['user', 'post', 'assignment', 'class', 'attendance', 'submission']
  },
  reference_type: {
    type: String
  },
  reference_id: {
    type: mongoose.Schema.Types.ObjectId
  },
  is_read: {
    type: Boolean,
    default: false
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('notification', notificationSchema);