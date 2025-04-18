const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
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
  username: {
    type: String,
    required: true,
    unique: true,
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
  password: {
    type: String,
    required: true
  },
  phone_number: {
    type: String,
    maxLength: 50,
    default: undefined
  },
  avatar_path: {
    type: String
  },
  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline'
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userSchema.index({ phone_number: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('user', userSchema);