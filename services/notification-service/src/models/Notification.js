const mongoose = require('mongoose');
const { NOTIFICATION_TYPES, NOTIFICATION_CHANNELS, NOTIFICATION_STATUS } = require('../../../../shared/constants/constant');

const notificationSchema = new mongoose.Schema(
    {
        recipientId: { type: String, required: true, index: true },
        recipientEmail: { type: String, required: true },
        recipientName: { type: String, required: true },

        type: {
            type: String,
            enum: Object.values(NOTIFICATION_TYPES),
            required: true,
            index: true,
        },

        channel: {
            type: String,
            enum: Object.values(NOTIFICATION_CHANNELS),
            required: true,
        },

        status: {
            type: String,
            enum: Object.values(NOTIFICATION_STATUS),
            default: NOTIFICATION_STATUS.PENDING,
            index: true,
        },

        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

        errorMessage: { type: String, default: null },

        sentAt: { type: Date, default: null },
    },
    { timestamps: true }
);

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = { Notification, NOTIFICATION_TYPES, NOTIFICATION_CHANNELS, NOTIFICATION_STATUS };
