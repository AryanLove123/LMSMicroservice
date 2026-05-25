const express = require('express');
const createEmployeeRoutes = require('./routes/EmployeeRoute');
const EmployeeService = require('./services/EmployeeService');
const EmployeeController = require('./controllers/EmployeeController');
const {UserCreatedConsumer} = require('./services/UserCreatedConsumer');

const createApp = async (logger, rabbitMQ = null) => {
    const app = express();
    app.use(express.json());    

    const empService = new EmployeeService(logger, rabbitMQ);
    const empController = new EmployeeController(empService);
    const empRoutes = createEmployeeRoutes(empController);
    const userCreatedConsumer = new UserCreatedConsumer(empService, rabbitMQ, logger);
    await userCreatedConsumer.startListening(); 
    app.use('/api/employees', empRoutes);

    return app;
};

module.exports = createApp;