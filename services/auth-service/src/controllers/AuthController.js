const ApiResponse = require('../../../../shared/utils/ApiResponse');
const { AuthValidator } = require('../validators/AuthValidator');
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

    refresh = async (req, res, next) => {
        try {
            const { refreshToken } = AuthValidator.validateRefresh(req.body);
            const result = await this.authService.refresh(refreshToken);
            return ApiResponse.ok(res, 'Token refreshed successfully', result);
        } catch (error) {
            next(error);
        }
    }

    logout = async (req, res, next) => {
        try {
            const { refreshToken } = AuthValidator.validateRefresh(req.body);
            await this.authService.logout(refreshToken);
            return ApiResponse.ok(res, 'Logged out successfully');
        } catch (error) {
            next(error);
        }
    }

    logoutAll = async (req, res, next) => {
        try {
            // req.user is populated by authenticate middleware
            await this.authService.logoutAll(req.user.userId);
            return ApiResponse.ok(res, 'Logged out from all devices successfully');
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AuthController;