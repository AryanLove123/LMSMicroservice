const nodemailer = require('nodemailer');
const NotificationDriver = require('./NotificationDriver');

class EmailDriver extends NotificationDriver {
    constructor(smtpConfig, logger) {
        super();
        this.logger = logger;
        this.from = smtpConfig.from;
        this.transporter = null;
        this.ready = this.init(smtpConfig);
    }

    async init(smtpConfig) {
        this.transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
        });

        await this.transporter.verify();

        this.logger.info('[EmailDriver] SMTP connection established', {
            host: smtpConfig.host,
            port: smtpConfig.port,
        });
    }

    async send({ to, toName, subject, html }) {
        await this.ready;

        const info = await this.transporter.sendMail({
            from: this.from,
            to: toName ? `"${toName}" <${to}>` : to,
            subject,
            html,
        });

        this.logger.info('[EmailDriver] Email sent', {
            to,
            subject,
            messageId: info.messageId,
        });
    }
}

module.exports = EmailDriver;