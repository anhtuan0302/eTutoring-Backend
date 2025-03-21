const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    type: {
        type: String,
        enum: ['access', 'refresh'],
        required: true
    },
    value: {
        type: String,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    expires_at: {
        type: Date,
        required: true
    },
    is_revoked: {
        type: Boolean,
        default: false
    },
    revoked_at: {
        type: Date
    },
    created_by_ip: {
        type: String
    }
});

module.exports = mongoose.model('Token', tokenSchema);