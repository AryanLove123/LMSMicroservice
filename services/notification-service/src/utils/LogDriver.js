const NotificationDriver = require('./NotificationDriver');

class LogDriver extends NotificationDriver {
    constructor(logger) {
        super();
        this.logger = logger;
    }

    async send({ to, toName, subject, metadata }) {
        this.logger.info('[LogDriver] Notification dispatched (log channel)', {
            to,
            toName,
            subject,
            metadata,
        });
    }
}

module.exports = LogDriver;
