const { get } = require('mongoose');
const ApiResponse = require('../../../../shared/utils/ApiResponse');
class NotificationController {
    constructor(notificationService) {
        this.notificationService = notificationService;
        this.getMyNotifications = this.getMyNotifications.bind(this);
    }

    async getMyNotifications(req, res, next) {
        try {
            const { page = 1, limit = 10, type } = req.query;
            const result = await this.notificationService.getNotifications(req.user.userId, {
                page: parseInt(page), limit: parseInt(limit), type,
            });
            return ApiResponse.paginated(res, 'Notifications retrieved', result.notifications, result.pagination);
        } catch (err) { return next(err); }
    }
}

module.exports = NotificationController;