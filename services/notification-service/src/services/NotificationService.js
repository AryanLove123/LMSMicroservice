class NotificationService {
    constructor(logger, rabbitMQ) {
        this.logger = logger;
        this.rabbitMQ = rabbitMQ;
    }

    async getNotifications(userId, { page, limit, type }) {
        const query = { userId };
        if (type) {
            query.type = type;
        }
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Notification.countDocuments(query);
        return {
            notifications,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}

module.exports = NotificationService;