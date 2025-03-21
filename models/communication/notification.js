const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  notification_type: {
    type: String,
    required: true
  },
  reference_type: {
    type: String
  },
  reference_id: {
    type: mongoose.Schema.Types.ObjectId
  },
  should_email: {
    type: Boolean,
    default: false
  },
  is_read: {
    type: Boolean,
    default: false
  },
  is_email_sent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('notification', notificationSchema);