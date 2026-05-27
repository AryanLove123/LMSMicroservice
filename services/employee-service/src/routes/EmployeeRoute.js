const express = require('express');
const { authenticate, authorize, authorizeOwnerOrManager } = require('../../../../shared/middlewares/authMiddleware');
const createEmployeeRoutes = (employeeController) => {
    const router = express.Router();
    router.use(authenticate);

    router.get('/profile', employeeController.getMe);
    router.get('/leave-balance', employeeController.getLeaveBalance);
    router.get('/team', authorize(['admin', 'manager']), employeeController.getTeamMembers);
    router.get('/managers', authorize(['admin']), employeeController.getManagers);

    router.get('/', authorize(['admin']), employeeController.getAllEmployees);

    router.get('/:employeeId/leave-balance', employeeController.getLeaveBalance);

    router.get('/:id', authorizeOwnerOrManager, employeeController.getEmployeeById);
    router.put('/:id', authorize(['admin']), employeeController.updateEmployee);
    router.delete('/:id', authorize(['admin']), employeeController.deactivateEmployee);

    return router;
}

module.exports = createEmployeeRoutes;