const express = require('express');
const { authenticate, authorize } = require('../../../../shared/middlewares/authMiddleware');
const router = express.Router();

const createAuthRoutes = (authController) => {
    // Public routes
    router.post('/login', authController.login);
    router.post('/refresh', authController.refresh);
    router.post('/logout', authController.logout);

    // Protected routes
    router.post('/register', authenticate, authorize(['admin']), authController.createUser);
    router.post('/logout-all', authenticate, authController.logoutAll);
    router.post('/verify', authenticate, authController.verifyToken);
    return router;
};

module.exports = createAuthRoutes;