const express = require('express');
const createEmployeeRoutes = require('./routes/EmployeeRoute');
const EmployeeService = require('./services/EmployeeService');
const EmployeeController = require('./controllers/EmployeeController');
const { UserCreatedConsumer } = require('./services/UserCreatedConsumer');
const SagaConsumer = require('./saga/SagaConsumer');

const createApp = async (logger, rabbitMQ = null) => {
    const app = express();
    app.use(express.json());

    const empService = new EmployeeService(logger, rabbitMQ);
    const empController = new EmployeeController(empService);
    const empRoutes = createEmployeeRoutes(empController);
    const userCreatedConsumer = new UserCreatedConsumer(empService, rabbitMQ, logger);
    await userCreatedConsumer.startListening();

    const sagaConsumer = new SagaConsumer(rabbitMQ, logger, empService);
    await sagaConsumer.startListening();
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