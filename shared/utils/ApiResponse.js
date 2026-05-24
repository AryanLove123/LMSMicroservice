class ApiResponse {
    static send(res, statusCode, message, data = null, meta = {}) {
        const body = {
            success: statusCode < 400,
            message,
            ...(data !== null && { data }),
            ...(Object.keys(meta).length && { meta }),
        };
        return res.status(statusCode).json(body);
    }

    static ok(res, message, data, meta) {
        return ApiResponse.send(res, 200, message, data, meta);
    }
    static created(res, message, data) {
        return ApiResponse.send(res, 201, message, data);
    }

    static badRequest(res, message, errors = null) {
        return res.status(400).json({ success: false, message, ...(errors && { errors }) });
    }
    static unauthorized(res, message = 'Unauthorized') {
        return res.status(401).json({ success: false, message });
    }
    static forbidden(res, message = 'Forbidden') {
        return res.status(403).json({ success: false, message });
    }
    static notFound(res, message = 'Resource not found') {
        return res.status(404).json({ success: false, message });
    }
    static conflict(res, message) {
        return res.status(409).json({ success: false, message });
    }
    static unprocessable(res, message, errors = null) {
        return res.status(422).json({ success: false, message, ...(errors && { errors }) });
    }
    static internalError(res, message = 'Internal server error', traceId = null) {
        return res.status(500).json({ success: false, message, ...(traceId && { traceId }) });
    }
}

module.exports = ApiResponse;
