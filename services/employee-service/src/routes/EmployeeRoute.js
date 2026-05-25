const express = require('express');
const createEmployeeRoutes = (employeeController) => {
    const router = express.Router();    
    return router;
}

module.exports = createEmployeeRoutes;