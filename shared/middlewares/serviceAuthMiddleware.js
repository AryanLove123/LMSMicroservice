const AppError = require('../utils/AppError');
const crypto = require('crypto');

const serviceAuthMiddleware = (req, res, next) => {
    const serviceToken = req.headers['x-service-token'];
    const callerName = req.headers['x-service-name'] || 'unknown';
    const expectedToken = process.env.INTERNAL_SERVICE_SECRET;

    if (!expectedToken) {
        console.error('[ServiceAuth] INTERNAL_SERVICE_SECRET is not configured!');
        return next(AppError.internal('Service authentication not configured'));
    }

    if (!serviceToken) {
        return next(AppError.unauthorized('Missing service authentication token'));
    }


    const provided = Buffer.from(serviceToken);
    const expected = Buffer.from(expectedToken);

    if (
        provided.length !== expected.length ||
        !crypto.timingSafeEqual(provided, expected)
    ) {
        console.warn(`[ServiceAuth] Invalid token from service: ${callerName}`);
        return next(AppError.forbidden('Invalid service authentication token'));
    }

    req.isInternalService = true;
    req.callerServiceName = callerName;

    next();
};

module.exports = serviceAuthMiddleware;