const router = require('express').Router();
const { authenticate } = require('../../../../shared/middlewares/authMiddleware');   

const createNotificationRoutes = (notificationController) => {
    router.use(authenticate);
    router.get('/', notificationController.getMyNotifications);
    return router;
}

module.exports = createNotificationRoutes;