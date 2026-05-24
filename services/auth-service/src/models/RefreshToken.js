const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
    jti: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
});

// MongoDB TTL index — auto-deletes expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
