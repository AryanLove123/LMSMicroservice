const config = require('./config');
const { initTracer, shutdownTracer } = require('../../../shared/utils/tracer');
initTracer(config.serviceName);

const mongoose = require('mongoose');
const createApp = require('./app');
const { createServiceLogger } = require('../../../shared/utils/logger');
const rabbitMQManager = require('../../../shared/utils/rabbitmq');
const logger = createServiceLogger(config.serviceName);

let server;
let rabbitMQInstance;

const shutdown = async (signal) => {
    logger.info(`[Shutdown] ${signal} received — shutting down gracefully`);
    try {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (rabbitMQInstance) await rabbitMQInstance.close();
        await mongoose.connection.close();
        await shutdownTracer();
    } catch (err) {
        logger.error('[Shutdown] Error during shutdown', { error: err.message });
    } finally {
        logger.close();
        process.exit(0);
    }
};

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const startServer = async () => {
    try {
        await mongoose.connect(config.mongodbUri);
        logger.info('[MongoDB] Connected to leave_db');
        rabbitMQInstance = new rabbitMQManager(logger);
        await rabbitMQInstance.connect(config.rabbitmqUri);
        const app = await createApp(logger, rabbitMQInstance);
        server = app.listen(config.port, () => {
            logger.info(`[Server] ${config.serviceName} running on port ${config.port}`);
        });
    } catch (error) {
        logger.error(`[Server] Error starting ${config.serviceName}: ${error.message}`);
        process.exit(1);
    }
};

startServer();