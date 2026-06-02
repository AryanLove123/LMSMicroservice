const express = require('express');
const config  = require('./config');

const NotificationService  = require('./services/NotificationService');
const NotificationConsumer = require('./services/NotificationConsumer');
const NotificationController = require('./controllers/NotificationController');
const notificationRoutes   = require('./routes/NotificationRoute');

const EmailDriver = require('./utils/EmailDriver');
const LogDriver   = require('./utils/LogDriver');

const createApp = async (logger, rabbitMQ = null) => {
    const app = express();
    app.use(express.json());

    const driver = config.notificationChannel === 'email'
        ? new EmailDriver(config.smtp, logger)
        : new LogDriver(logger);

    logger.info(`[App] Notification channel: ${config.notificationChannel}`);

    const notifyService    = new NotificationService(logger, rabbitMQ, driver);
    const notifyController = new NotificationController(notifyService);
    const notifyRoutes     = notificationRoutes(notifyController);

    app.use('/api/notifications', notifyRoutes);

    if (rabbitMQ) {
        const consumer = new NotificationConsumer(rabbitMQ, logger, notifyService);
        await consumer.startListening();
    }

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
};

module.exports = createApp;
