const express = require('express');
const createAuthRoutes = require('./routes/AuthRoute');
const AuthService = require('./services/AuthService');
const AuthController = require('./controllers/AuthController');

const createApp = (logger) => {
    const app = express();
    app.use(express.json());

    const authService = new AuthService(logger);
    const authController = new AuthController(authService);
    const authRoutes = createAuthRoutes(authController);

    app.use('/api/auth', authRoutes);
    return app;
}

module.exports = createApp;