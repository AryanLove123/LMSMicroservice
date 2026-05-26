const express = require('express');
const { authenticate, authorize } = require('../../../../shared/middlewares/authMiddleware');   
const createLeaveRoutes = (leaveController) => {
    const router = express.Router();
    return router;
}

module.exports = createLeaveRoutes;