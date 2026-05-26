const express = require('express');
const { authenticate, authorize } = require('../../../../shared/middlewares/authMiddleware');   
const createLeaveRoutes = (leaveController) => {
    const router = express.Router();
    router.use(authenticate);
    router.post('/', authorize(['employee']), leaveController.requestLeave);
    router.get('/', authorize(['admin', 'manager']), leaveController.getTeamLeaves);
    router.put('/:id/review', authorize(['manager', 'admin']), leaveController.reviewLeave);
    router.put('/:id/cancel', authorize(['employee']), leaveController.cancelLeave);
    return router;
}

module.exports = createLeaveRoutes;