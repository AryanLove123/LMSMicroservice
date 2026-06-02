const express = require('express');
const createAuthRoutes = require('./routes/AuthRoute');
const AuthService = require('./services/AuthService');
const AuthController = require('./controllers/AuthController');

const createApp = (logger, rabbitMQ = null) => {
    const app = express();
    app.use(express.json());

    const authService = new AuthService(logger, rabbitMQ);
    const authController = new AuthController(authService);
    const authRoutes = createAuthRoutes(authController);

    app.use('/api/auth', authRoutes);

    app.use((err, req, res, next) => {
        const statusCode = err.statusCode || 500;
        logger.error(`[ErrorHandler] ${err.message}`, {
            statusCode,
            code: err.code,
            stack: err.stack,
        });
        return res.status(statusCode).json({
            success: false,
            message: err.message || 'Internal Server Error',
            code: err.code || 'INTERNAL_ERROR',
            ...(err.details && { details: err.details }),
        });
    });
    return app;
}

module.exports = createApp;