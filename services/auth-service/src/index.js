const config = require('./config');
const { initTracer, shutdownTracer } = require('../../../shared/utils/tracer');
initTracer(config.serviceName);
const mongoose = require('mongoose');
const createApp = require('./app');
const { createServiceLogger } = require('../../../shared/utils/logger');
const rabbitMQManager = require('../../../shared/utils/rabbitmq');
const User = require('./models/User');
const { ROLES } = require('../../../shared/constants/constant');
const logger = createServiceLogger(config.serviceName);
const ConsulClient = require('../../../shared/utils/ConsulClient');

let server;
let rabbitMQInstance;

const startServer = async () => {
    let consulClient;
    let serviceId;
    try {
        await mongoose.connect(config.mongodbUri);
        logger.info('[MongoDB] Connected to auth_db');

        rabbitMQInstance = new rabbitMQManager(logger);
        await rabbitMQInstance.connect(config.rabbitmqUri);

        await seedAdmin();

        const app = createApp(logger, rabbitMQInstance);
        server = app.listen(config.port, async () => {
            logger.info(`[Server] ${config.serviceName} running on port ${config.port}`);
            try {
                consulClient = new ConsulClient(logger);
                serviceId = await consulClient.register(
                    config.serviceName,
                    config.port
                );
            } catch (err) {
                logger.warn('[Consul] Could not register, continuing without service discovery');
            }
        });
    } catch (err) {
        logger.error('[Startup] Fatal error', { error: err.message, stack: err.stack });
        process.exit(1);
    }
    const shutdown = async (signal) => {
        logger.info(`[Shutdown] ${signal} received — shutting down gracefully`);
        try {
            if (consulClient && serviceId) {
                await consulClient.deregister(serviceId);
            }
            // 1. Stop accepting new HTTP connections (existing ones finish naturally)
            if (server) await new Promise((resolve) => server.close(resolve));
            // 2. Close RabbitMQ channel + connection (prevents reconnect timer firing)
            if (rabbitMQInstance) await rabbitMQInstance.close();
            // 3. Close MongoDB connection
            await mongoose.connection.close();
            // 4. Flush all pending OTel spans to Jaeger
            await shutdownTracer();
        } catch (err) {
            logger.error('[Shutdown] Error during shutdown', { error: err.message });
        } finally {
            // 5. Flush + destroy the Logstash TCP socket last
            logger.close();
            process.exit(0);
        }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
};

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