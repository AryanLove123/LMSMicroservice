const path = require('path');
// 1. Load root .env first — shared/global defaults (JWT, bcrypt, consul, logging, etc.)
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
// 2. Load service .env second — service-specific values override root defaults
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const config = {
    serviceName: process.env.SERVICE_NAME || 'notification-service',
    port: process.env.PORT || 3004,
    mongodbUri: process.env.MONGODB_URI,
    rabbitmqUri: process.env.RABBITMQ_URI,
};

module.exports = config;