const config = require('./config');
const mongoose = require('mongoose');
const createApp = require('./app');
const { createServiceLogger } = require('../../../shared/utils/logger');
const rabbitMQManager = require('../../../shared/utils/rabbitmq');
const User = require('./models/User');
const { ROLES } = require('../../../shared/constants/constant');
const logger = createServiceLogger(config.serviceName);
const startServer = async () => {
    try {
        await mongoose.connect(config.mongodbUri);
        logger.info('[MongoDB] Connected to auth_db');

        const rabbitMQManagerInstance = new rabbitMQManager(logger);

        await rabbitMQManagerInstance.connect(config.rabbitmqUri);

        await seedAdmin();

        const app = createApp(logger, rabbitMQManagerInstance);
        const server = app.listen(config.port, () => {
            logger.info(`[Server] ${config.serviceName} running on port ${config.port}`);
        });
    } catch (err) {
        logger.error('[Startup] Fatal error', { error: err.message, stack: err.stack });
        process.exit(1);
    }
}

const seedAdmin = async () => {
    const existing = await User.findByEmail(config.admin.email);
    if (!existing) {
        await User.create({
            name: config.admin.name,
            email: config.admin.email,
            password: config.admin.password,
            role: ROLES.ADMIN,
        });
        logger.info('[Seed] Admin user created');
    } else {
        logger.info('[Seed] Admin user already exists – skipping');
    }
};

startServer();