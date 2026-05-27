const express = require('express');
const createLeaveRoutes = require('./routes/LeaveRoute');
const LeaveService = require('./services/LeaveService');
const LeaveController = require('./controllers/LeaveController');
const ServiceHttpClient = require('./utils/ServiceHttpClient');
const config = require('./config');

const createApp = async (logger, rabbitMQ = null) => {
    const app = express();
    app.use(express.json()); 
    const empClient = new ServiceHttpClient(config.employeeServiceUrl, 'employee-service', logger);   
    const leaveService = new LeaveService(logger, rabbitMQ, empClient);
    const leaveController = new LeaveController(leaveService);
    const leaveRoutes = createLeaveRoutes(leaveController);

    app.use('/api/leaves', leaveRoutes);
    return app;
};

module.exports = createApp;