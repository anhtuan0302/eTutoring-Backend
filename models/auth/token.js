const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    type: {
        type: String,
        enum: ['access', 'refresh', 'password-reset'],
        required: true
    },
    value: {
        type: String,
        required: true,
        index: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    expires_at: {
        type: Date,
        required: true,
        index: true
    },
    is_revoked: {
        type: Boolean,
        default: false,
        index: true
    },
    revoked_at: {
        type: Date
    },
    created_by_ip: {
        type: String
    }
});

// Index để tăng tốc độ tìm kiếm token
tokenSchema.index({ user_id: 1, type: 1, is_revoked: 1 });
tokenSchema.index({ value: 1, type: 1, is_revoked: 1 });

module.exports = mongoose.model('Token', tokenSchema);