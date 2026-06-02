const express = require('express');
const createLeaveRoutes = require('./routes/LeaveRoute');
const LeaveService = require('./services/LeaveService');
const LeaveController = require('./controllers/LeaveController');
const ServiceHttpClient = require('./utils/ServiceHttpClient');
const config = require('./config');
const SagaOrchestrator = require('./saga/SagaOrchestrator');
const SagaReplyConsumer = require('./saga/SagaReplyConsumer');

const createApp = async (logger, rabbitMQ = null) => {
    const app = express();
    app.use(express.json());
    const sagaOrchestrator = new SagaOrchestrator(rabbitMQ, logger);

    const empClient = new ServiceHttpClient(null, 'employee-service', logger);
    const leaveService = new LeaveService(logger, rabbitMQ, empClient, sagaOrchestrator);
    const leaveController = new LeaveController(leaveService);
    const leaveRoutes = createLeaveRoutes(leaveController);

    const sagaReplyConsumer = new SagaReplyConsumer(rabbitMQ, logger, sagaOrchestrator);
    await sagaReplyConsumer.startListening();

    app.get('/health', (req, res) => {
        res.json({
            status: 'UP',
            service: config.serviceName,
            timestamp: new Date().toISOString()
        });
    });

    app.use('/api/leaves', leaveRoutes);
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