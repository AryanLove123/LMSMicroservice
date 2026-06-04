const express = require('express');
const createEmployeeRoutes = require('./routes/EmployeeRoute');
const EmployeeService = require('./services/EmployeeService');
const EmployeeController = require('./controllers/EmployeeController');
const { UserCreatedConsumer } = require('./services/UserCreatedConsumer');
const SeedManagerAssignConsumer = require('./services/SeedManagerAssignConsumer');
const SagaConsumer = require('./saga/SagaConsumer');
const config = require('./config');

const createApp = async (logger, rabbitMQ = null) => {
    const app = express();
    app.use(express.json());

    const empService = new EmployeeService(logger, rabbitMQ);
    const empController = new EmployeeController(empService);
    const empRoutes = createEmployeeRoutes(empController);
    const userCreatedConsumer = new UserCreatedConsumer(empService, rabbitMQ, logger);
    await userCreatedConsumer.startListening();

    const seedConsumer = new SeedManagerAssignConsumer(rabbitMQ, logger);
    await seedConsumer.startListening();


    const sagaConsumer = new SagaConsumer(rabbitMQ, logger, empService);
    await sagaConsumer.startListening();

    app.get('/health', (req, res) => {
        res.json({
            status: 'UP',
            service: config.serviceName,
            timestamp: new Date().toISOString()
        });
    });

    app.use('/api/employees', empRoutes);

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