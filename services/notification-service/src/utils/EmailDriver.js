// const nodemailer = require('nodemailer');
// const NotificationDriver = require('./NotificationDriver');

// class EmailDriver extends NotificationDriver {
//     constructor(smtpConfig, logger) {
//         super();
//         this.logger = logger;
//         this.from   = smtpConfig.from;

//         this.transporter = nodemailer.createTransport({
//             host:   smtpConfig.host,
//             port:   smtpConfig.port,
//             secure: smtpConfig.port === 465,
//             auth: {
//                 user: smtpConfig.user,
//                 pass: smtpConfig.pass,
//             },
//         });
//     }

//     async send({ to, toName, subject, html }) {
//         const info = await this.transporter.sendMail({
//             from:    this.from,
//             to:      toName ? `"${toName}" <${to}>` : to,
//             subject,
//             html,
//         });
//         this.logger.info('[EmailDriver] Email sent', { to, subject, messageId: info.messageId });
//     }
// }

// module.exports = EmailDriver;


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
        let config = smtpConfig;

        // Auto-create Ethereal account if creds missing
        if (!smtpConfig.user || !smtpConfig.pass) {
            const testAccount = await nodemailer.createTestAccount();

            this.logger.info('[EmailDriver] Ethereal test account created', {
                user: testAccount.user,
            });

            config = {
                ...smtpConfig,
                user: testAccount.user,
                pass: testAccount.pass,
            };
        }

        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.pass,
            },
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

        const previewUrl = nodemailer.getTestMessageUrl(info);

        if (previewUrl) {
            this.logger.info(`[EmailDriver] Preview URL: ${previewUrl}`);
        }
    }
}

module.exports = EmailDriver;