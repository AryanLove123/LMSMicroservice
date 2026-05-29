const mongoose = require('mongoose');
const { LEAVE_TYPES, LEAVE_STATUS, SAGA_STATUS } = require('../../../../shared/constants/constant');

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
    employeeName: { 
        type: String, 
        default: null 
    },
    employeeEmail: { 
        type: String, 
        default: null 
    },
    managerEmail: { 
        type: String, 
        default: null 
    },
    managerName: { 
        type: String, 
        default: null 
    },
    numberOfDays: { 
        type: Number, 
        default: null 
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
    reviewedAt: {
        type: Date,
        default: null
    },
    reviewComments: {
        type: String,
        default: null,
        maxlength: 500
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
    originalStartDate: {
        type: Date,
        default: null
    },
    originalNumberOfDays: {
        type: Number,
        default: null
    },
    trimNote: {
        type: String,
        default: null
    },
    sagaId: {
        type: String,
        default: null,
    },
    sagaStatus: {
        type: String,
        enum: Object.values(SAGA_STATUS),
        default: null,
    }
}, { timestamps: true });


leaveRequestSchema.statics.findOverlappingLeaves = function (employeeId, startDate, endDate) {
    return this.findOne({
        employeeId,
        status: { $in: [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED] },
        $or: [
            { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
        ]
    });
}

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);