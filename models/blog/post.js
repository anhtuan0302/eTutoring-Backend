const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  file_name: {
    type: String,
    required: true
  },
  file_path: {
    type: String,
    required: true
  },
  file_type: {
    type: String,
    required: true,
    enum: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
  },
  file_size: {
    type: Number,
    required: true,
    max: 1024 * 1024 * 10
  }
});

const postSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255,
  },
  content: {
    type: String,
    required: true,
    minlength: 10
  },
  post_category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'postCategory',
    required: true
  },
  attachments: [attachmentSchema],
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'pending'
  },
  view_count: {
    type: Number,
    default: 0
  },
  viewed_by: [{  
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  }],
  is_deleted: {
    type: Boolean,
    default: false
  },
  moderated_info: {
    moderated_at: Date,
    moderated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user'
    },
    reason: String
  }
}, {
  timestamps: true
});

postSchema.pre('save', async function(next) {
  if (this.isModified('is_deleted') && this.is_deleted) {
    this.attachments.forEach(attachment => {
      fs.unlink(attachment.file_path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    });
  }
  next();
});

module.exports = mongoose.model('post', postSchema);