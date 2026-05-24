const mongoose = require('mongoose');
const { ROLES } = require('../../../../shared/constants/constant');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [80, 'Name cannot exceed 100 characters']
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters'],
            select: false,
        },
        role: {
            type: String,
            enum: Object.values(ROLES),
            default: ROLES.EMPLOYEE,
        },
        employeeId: {
            type: String,
            sparse: true,
            unique: true
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLogin: {
            type: Date,
        },
    }
);

//indexing
userSchema.index({ role: 1 });


//middleware
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  this.password = await bcrypt.hash(this.password, rounds);
});

//Instance Methods 
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.statics.findByEmail = function(email, includePassword = false) {
  const query = this.findOne({ email: email.toLowerCase() });
  return includePassword ? query.select('+password') : query;
};

const User = mongoose.model('User', userSchema);
module.exports = User;