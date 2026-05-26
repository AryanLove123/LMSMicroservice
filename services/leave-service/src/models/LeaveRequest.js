const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    employeeId: {
        type: String,
        required: true,
        index: true
    },
    managerId: {
        type: String,
        required: true,
        index: true
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required'],
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required'],
    },
    leaveType: {
        type: String,
        enum: Object.values(LEAVE_TYPES),
        required: [true, 'Leave type is required'],
    },
    reason: {
        type: String,
        trim: true,
        maxLength: [500, 'Reason cannot exceed 500 characters'],
    },
    status: {   
        type: String,
        enum: Object.values(LEAVE_STATUS),
        default: LEAVE_STATUS.PENDING,
        index: true
    },
    approvedAt: {
        type: Date,
    },
    cancelledAt: {
        type: Date,
    },
    cancelledReason: {
        type: String,
        trim: true,
        maxLength: [500, 'Cancelled reason cannot exceed 500 characters'],
    },
}, { timestamps: true });   


leaveRequestSchema.statics.findOverlappingLeaves = function(employeeId, startDate, endDate) {
    return this.findOne({
        employeeId,
        status: { $in: [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED] },
        $or: [
            { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
        ]
    });
}

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);