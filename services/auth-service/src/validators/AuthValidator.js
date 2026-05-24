const Joi = require('joi');
const AppError = require('../../../../shared/utils/AppError');
const { ROLES } = require('../../../../shared/constants/constant');
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
}

class AuthValidator extends BaseValidator {
    static loginSchema = Joi.object({
        email: Joi.string().email().lowercase().trim().required(),
        password: Joi.string().min(8).required(),
    });

    static createUserSchema = Joi.object({
        name: Joi.string().min(2).max(80).trim().required(),
        email: Joi.string().email().lowercase().trim().required(),
        password: Joi.string().min(8).required(),
        role: Joi.string()
            .valid(...Object.values(ROLES))
            .default(ROLES.EMPLOYEE),
        employeeId: Joi.string().optional(),
    });


    static refreshSchema = Joi.object({
        refreshToken: Joi.string().required(),
    });

    static validateLogin(data) {
        return AuthValidator.validate(AuthValidator.loginSchema, data);
    }

    static validateCreateUser(data) {
        return AuthValidator.validate(AuthValidator.createUserSchema, data);
    }

    static validateRefresh(data) {
        return AuthValidator.validate(AuthValidator.refreshSchema, data);
    }
}

module.exports = { AuthValidator };