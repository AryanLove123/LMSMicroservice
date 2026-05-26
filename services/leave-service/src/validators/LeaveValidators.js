const Joi = require('joi');
const AppError = require('../../../../shared/utils/AppError');
const { LEAVE_TYPES } = require('../../../../shared/constants/constant');
class BaseValidator {
    static validate(schema, data) {
        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const details = error.details.map((d) => d.message);
            throw AppError.unprocessable('Validation failed', details);
        }
        return value;
    }
};

class LeaveValidator extends BaseValidator {
    static requestLeaveSchema = Joi.object({
        leaveType: Joi.string().valid(...Object.values(LEAVE_TYPES)).required(),
        startDate: Joi.date().iso().required(),
        endDate: Joi.date().iso().required(),
        reason: Joi.string().max(500).trim().required(),
    }); 

    static reviewLeaveSchema = Joi.object({
        action: Joi.string().valid('approve', 'reject').required(),
        comments: Joi.string().max(500).trim().optional(),
    });

    static cancelLeaveSchema = Joi.object({
        reason: Joi.string().max(500).trim().required(),
    });

    static validateRequestLeave(data) {
        return LeaveValidator.validate(LeaveValidator.requestLeaveSchema, data);
    }       

    static validateReviewLeave(data) {
        return LeaveValidator.validate(LeaveValidator.reviewLeaveSchema, data);
    }

    static validateCancelLeave(data) {
        return LeaveValidator.validate(LeaveValidator.cancelLeaveSchema, data);
    }
}

module.exports = { LeaveValidator };        