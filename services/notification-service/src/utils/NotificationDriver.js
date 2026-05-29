class NotificationDriver {
    async send({ to, toName, subject, html, metadata }) {
        throw new Error(`${this.constructor.name} must implement send()`);
    }
}

module.exports = NotificationDriver;
