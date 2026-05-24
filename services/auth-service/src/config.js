const path = require('path');

// 1. Load root .env first — shared/global defaults (JWT, bcrypt, consul, logging, etc.)
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
// 2. Load service .env second — service-specific values override root defaults
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const config = {
  serviceName: process.env.SERVICE_NAME || 'auth-service',
  port: process.env.PORT || 3001,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@company.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456',
    name: process.env.ADMIN_NAME || 'System Administrator',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10),
  mongodbUri: process.env.MONGODB_URI,
};

module.exports = config;
