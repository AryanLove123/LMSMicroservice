const config = require('./config');
const {RABBIT_EXCHANGES,RABBIT_ROUTING_KEYS} = require('../../../shared/constants/constant');
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

        await seedUsers(rabbitMQInstance);

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

const seedUser = async (userData, mqManager) => {
    const existing = await User.findByEmail(userData.email);
    if (existing) {
        logger.info(`[Seed] Already exists, skipping: ${userData.email}`);
        return { user: existing, isNew: false };
    }

    const user = await User.create(userData);

    await mqManager.publish(
        RABBIT_EXCHANGES.USER_EVENTS,
        RABBIT_ROUTING_KEYS.USER_CREATED,
        {
            userId: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            joiningDate: user.createdAt.toISOString(),
            isActive: user.isActive,
        }
    );

    logger.info(`[Seed] Created + published USER_CREATED: ${userData.email} (${userData.role})`);
    return { user, isNew: true };
};

const seedUsers = async (mqManager) => {
    const adminExists = await User.findByEmail(config.admin.email);
    if (!adminExists) {
        await User.create({
            name: config.admin.name,
            email: config.admin.email,
            password: config.admin.password,
            role: ROLES.ADMIN,
        });
        logger.info('[Seed] Admin created');
    } else {
        logger.info('[Seed] Admin already exists — skipping');
    }

    //Seed manager
    const { user: manager, isNew: managerIsNew } = await seedUser(
        {
            name: config.seed.manager.name,
            email: config.seed.manager.email,
            password: config.seed.manager.password,
            role: ROLES.MANAGER,
        },
        mqManager
    );

    //Seed employee
    const { user: employee, isNew: employeeIsNew } = await seedUser(
        {
            name: config.seed.employee.name,
            email: config.seed.employee.email,
            password: config.seed.employee.password,
            role: ROLES.EMPLOYEE,
        },
        mqManager
    );

    //Publish manager-assignment event
    if (managerIsNew || employeeIsNew) {
        await mqManager.publish(
            RABBIT_EXCHANGES.USER_EVENTS,
            RABBIT_ROUTING_KEYS.SEED_MANAGER_ASSIGN,
            {
                employeeUserId: employee._id.toString(),
                managerUserId: manager._id.toString(),
            }
        );
        logger.info(
            `[Seed] Published SEED_MANAGER_ASSIGN ` +
            `employee: ${employee._id}, manager: ${manager._id}`
        );
    } else {
        logger.info('[Seed] Both users already existed — skipping manager assignment event');
    }

    logger.info('[Seed] Seeding complete');
};

startServer();