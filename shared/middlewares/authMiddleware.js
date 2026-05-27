const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;  
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(AppError.unauthorized('Authorization token missing'));
    }   
    const token = authHeader.split(' ')[1];
    req.user = { rawToken: token };
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { ...req.user, ...decoded };
        next();
    } catch (err) {
        return next(AppError.unauthorized('Invalid token'));
    }
};

const authorize = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {   
            return next(AppError.forbidden('Access denied'));
        }
        next();
    }
};


const authorizeOwnerOrManager = (req, res, next) => {
  const { role, userId } = req.user || {};
  if (role === 'admin' || role === 'manager') return next();
  const targetId = req.params.id;
  if (role === 'employee' && userId == targetId) return next();
  return next(AppError.forbidden('Access denied'));
};

module.exports = { authenticate, authorize, authorizeOwnerOrManager };