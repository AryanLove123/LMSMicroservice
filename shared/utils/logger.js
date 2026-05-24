const { createLogger, format, transports } = require('winston');
const { combine, timestamp, errors, json, colorize, simple } = format;

const createServiceLogger = (serviceName) => {
    const logstashHost = process.env.LOGSTASH_HOST || 'localhost';
    const logstashPort = parseInt(process.env.LOGSTASH_PORT || '5000', 10);
    const isProduction = process.env.NODE_ENV === 'production';

    const logTransports = [
        new transports.Console({
            format: isProduction
                ? combine(timestamp(), errors({ stack: true }), json())
                : combine(colorize(), simple()),
        }),
    ];

    const { LogstashTransport } = require('winston-logstash-transport');
    logTransports.push(
      new LogstashTransport({
        host: logstashHost,
        port: logstashPort,
      })
    );

    const logger = createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: combine(timestamp(), errors({ stack: true }), json()),
        defaultMeta: { service: serviceName },
        transports: logTransports,
    });

    return logger;
}

module.exports = { createServiceLogger };