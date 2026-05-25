const mongoose = require('mongoose');
const config = require('./config');
const createApp = require('./app');
const { createServiceLogger } = require('../../../shared/utils/logger');
const rabbitMQManager = require('../../../shared/utils/rabbitmq');
const logger = createServiceLogger(config.serviceName);
const startServer = async () => {
    try {
        await mongoose.connect(config.mongodbUri);
        logger.info('[MongoDB] Connected to employee_db');

        const rabbitMQManagerInstance = new rabbitMQManager(logger);

        console.log("RabbitMQ URI: ", config.rabbitmqUri);

        await rabbitMQManagerInstance.connect(config.rabbitmqUri);

        const app = await createApp(logger, rabbitMQManagerInstance);
        const server = app.listen(config.port, () => {
            logger.info(`[Server] ${config.serviceName} running on port ${config.port}`);
        });
    } catch (error) {
        logger.error(`[Server] Error starting ${config.serviceName}: ${error.message}`);
        process.exit(1);

    }
}
startServer();