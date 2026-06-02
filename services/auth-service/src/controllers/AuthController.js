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

    //Internal Route for nginx
    verifyToken = async (req, res, next) => {
        try {
            const token = req.headers['authorization']?.split(' ')[1] || req.body?.token;
            if (!token) return res.status(401).json({ success: false, message: 'Token required' });
            const decoded = await this.authService.verifyToken(token);
            // Forward user info as headers for downstream services
            res.set('X-User-Id', decoded.userId);
            res.set('X-User-Role', decoded.role);
            res.set('X-User-Email', decoded.email);
            res.set('X-Employee-Id', decoded.employeeId || '');
            return ApiResponse.ok(res, 'Token valid', decoded);
        } catch (err) { return next(err); }
    }
}

module.exports = AuthController;