const mongoose = require('mongoose');

const { LEAVE_TYPES, LEAVE_COUNT } = require('../../../../shared/constants/constant');
const Counter = require('./Counter');
const {ROLES} = require('../../../../shared/constants/constant');

const LeaveBalanceSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: Object.values(LEAVE_TYPES),
            required: true,
        },
        total: {
            type: Number,
            min: 0,
        },
        used: {
            type: Number,
            default: 0,
        },
        remaining: {
            type: Number,
        }
    },
    { _id: false }
);

LeaveBalanceSchema.pre('save', function () {
    this.remaining = this.total - this.used;
});


const employeeSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            unique: true,
        },
        employeeCode: {
            type: String,
            sparse: true,
            unique: true,
        },
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            maxLength: [80, "Name cannot exceed 80 characters"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            trim: true,
            unique: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        department: {
            type: String,
            trim: true,
        },
        designation: {
            type: String,
            trim: true,
        },
        role: {
            type: String,
            enum: Object.values(ROLES),
            default: ROLES.EMPLOYEE,
        },
        managerId: {
            type: String,
            default: null,
            index: true
        },
        joiningDate: {
            type: Date,
            default: Date.now
        },
        isActive: {
            type: Boolean,
            default: true
        },
        leaveBalances: {
            type: [LeaveBalanceSchema],
            default: () =>
                Object.entries(LEAVE_COUNT).map(([type, total]) => ({
                    type,
                    total,
                    used: 0,
                    remaining: total,
                })),
        },
    },
    { timestamps: true });


//Auto generate employee code before saving
employeeSchema.pre('save', async function () {
    if (this.isNew && !this.employeeCode) {
        const seq = await Counter.nextVal('employeeCode');
        this.employeeCode = `EMP${String(seq).padStart(4, '0')}`;
    }
});

//instance methods
employeeSchema.methods.getLeaveBalance = function (leaveType) {
  return this.leaveBalances.find((b) => b.type === leaveType);
};

employeeSchema.methods.deductLeaveBalance = function (leaveType, days) {
  const balance = this.getLeaveBalance(leaveType);
  if (!balance) throw new Error(`Leave type ${leaveType} not found`);
  if (balance.remaining < days) throw new Error('Insufficient leave balance');
  balance.used += days;
  balance.remaining = balance.total - balance.used;
};

employeeSchema.methods.restoreLeaveBalance = function (leaveType, days) {
  const balance = this.getLeaveBalance(leaveType);
  if (!balance) return;
  balance.used = Math.max(0, balance.used - days);
  balance.remaining = balance.total - balance.used;
};

//Static Methods
employeeSchema.statics.findByUserId = function (userId) {
  return this.findOne({ userId, isActive: true });
};

employeeSchema.statics.findTeamByManagerId = function (managerId) {
  return this.find({ managerId, isActive: true });
};

const Employee = mongoose.model('Employee', employeeSchema);
const LeaveBalance = mongoose.model('LeaveBalance', LeaveBalanceSchema);
module.exports = { Employee, LeaveBalance };