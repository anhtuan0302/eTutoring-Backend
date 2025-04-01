const mongoose = require('mongoose');

const postCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  description: {
    type: String,
    maxLength: 255
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('postCategory', postCategorySchema);