const { LEAVE_TYPES, LEAVE_COUNT } = require('../../../../shared/constants/constant');

const LeaveBalanceSchema = new Schema(
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


const employeeSchema = new Schema(
    {
        userId: {
            type: String,
            required: true,
            unique: true,
        },
        employeeCode: {
            type: String,
            required: true,
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
        managerName: {
            type: String,
            default: null
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

module.exports = { LeaveBalanceSchema, employeeSchema };