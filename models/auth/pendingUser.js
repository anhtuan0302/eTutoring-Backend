const mongoose = require('mongoose');

const pendingUserSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['student', 'tutor', 'staff', 'admin'],
    required: true
  },
  first_name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  last_name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxLength: 255
  },
  phone_number: {
    type: String,
    maxLength: 50,
    default: undefined
  },
  department_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'department'
  },
  invitation_token: {
    type: String
  },
  invitation_sent_at: {
    type: Date
  },
  invitation_expires_at: {
    type: Date
  }
}, {
  timestamps: true
});

pendingUserSchema.index({ phone_number: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('pendingUser', pendingUserSchema);