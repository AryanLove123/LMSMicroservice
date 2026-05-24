class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details = null) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }
  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }
  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403, 'FORBIDDEN');
  }
  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }
  static conflict(message) {
    return new AppError(message, 409, 'CONFLICT');
  }
  static unprocessable(message, details = null) {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }
  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

module.exports = AppError;
