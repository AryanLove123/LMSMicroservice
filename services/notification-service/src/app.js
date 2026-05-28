const express = require('express');
const notificationService = require('./services/NotificationService');
const notificationController = require('./controllers/NotificationController')
const notificationRoutes = require('./routes/NotificationRoute');

const createApp = async(logger, rabbitMQ = null) => {
    const app = express();
    app.use(express.json()); 
    const notifyService = new notificationService(logger, rabbitMQ);
    const notifyController = new notificationController(notifyService);
    const notifyRoutes = notificationRoutes(notifyController);
    app.use('/api/notifications', notifyRoutes);

    return app;
}

module.exports = createApp;