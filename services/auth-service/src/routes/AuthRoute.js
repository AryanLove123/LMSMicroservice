const express = require('express');
const { authenticate, authorize } = require('../../../../shared/middlewares/authMiddleware');
const router = express.Router();

const createAuthRoutes = (authController) => {
    // Public routes
    router.get('/verify', authController.verifyToken);
    router.post('/verify', authController.verifyToken);
    router.post('/login', authController.login);
    router.post('/refresh', authController.refresh);
    
    // Protected routes
    router.post('/register', authenticate, authorize(['admin']), authController.createUser);
    router.post('/logout', authenticate,authController.logout);
    router.post('/logout-all', authenticate, authController.logoutAll);
    
    return router;
};

module.exports = createAuthRoutes;