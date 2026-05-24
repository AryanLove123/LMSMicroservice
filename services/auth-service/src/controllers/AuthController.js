const ApiResponse = require('../../../../shared/utils/ApiResponse');
const AuthValidator = require('../validators/AuthValidator');
class AuthController {
    constructor(authService) {
        this.authService = authService
    }

    createUser = async (req, res, next) => {
        try {
            const data = AuthValidator.validateCreateUser(req.body);
            const user = await this.authService.createUser(data);
            return ApiResponse.created(res, 'User created successfully', user);
        } catch (error) {
            next(error);
        }
    }

    login = async (req, res, next) => {
        try {
            const data = AuthValidator.validateLogin(req.body);
            const result = await this.authService.login(data);
            return ApiResponse.ok(res, 'Login successful', result);
        } catch (error) {
            next(error);
        }
    }

    verifyToken = async (req, res, next) => {
        try {
            const { token } = req.body;
            if (!token) return ApiResponse.badRequest(res, 'Token is required');  
            const result = await this.authService.verifyToken(token);
            return ApiResponse.ok(res, 'Token verification successful', result);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AuthController;