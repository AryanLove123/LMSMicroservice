const net = require('net');
const { createLogger, format, transports } = require('winston');
const Transport = require('winston-transport');
const { combine, timestamp, errors, json, colorize, simple } = format;

const { getActiveTraceIds } = require('./tracer');

//Stamps traceId + spanId from the currently active OTel span onto every log line
const traceContextFormat = format((info) => {
    const { traceId, spanId } = getActiveTraceIds();
    if (traceId) {
        info.traceId = traceId;
        info.spanId = spanId;
    }
    return info;
});

class LogstashTcpTransport extends Transport {
    constructor(opts = {}) {
        super(opts);
        this.host = opts.host || 'localhost';
        this.port = opts.port || 5000;
        this.retryInterval = opts.retryInterval || 3000;
        this.maxRetries = opts.maxRetries || 20;
        this._retries = 0;
        this._connected = false;
        this._reconnecting = false;
        this._queue = [];   // buffered while socket is down
        this._socket = null;
        this._connect();
    }

    _connect() {
        const sock = new net.Socket();
        sock.setKeepAlive(true, 30000);
        this._socket = sock;

        sock.on('connect', () => {
            this._connected = true;
            this._reconnecting = false;
            this._retries = 0;
            while (this._queue.length) {
                this._writeRaw(this._queue.shift());
            }
        });

        sock.on('error', (err) => {
            console.error('[LogstashTcpTransport] Socket error:', err.message);
        });

        sock.on('close', () => {
            this._connected = false;
            this._scheduleReconnect();
        });

        sock.connect(this.port, this.host);
    }

    _scheduleReconnect() {
        if (this._reconnecting) return;
        if (this._retries >= this.maxRetries) {
            console.error(`[LogstashTcpTransport] Max retries (${this.maxRetries}) reached — logs will not be sent to Logstash.`);
            return;
        }
        this._reconnecting = true;
        this._retries++;
        setTimeout(() => {
            this._reconnecting = false;
            this._connect();
        }, this.retryInterval);
    }

    _writeRaw(line) {
        try {
            this._socket.write(line + '\n');
        } catch (err) {
            console.error('[LogstashTcpTransport] Write error:', err.message);
        }
    }

    log(info, callback) {
        setImmediate(() => this.emit('logged', info));
        const message = info[Symbol.for('message')];
        if (this._connected) {
            this._writeRaw(message);
        } else {
            // cap the buffer to avoid unbounded memory growth
            if (this._queue.length < 200) {
                this._queue.push(message);
            }
        }
        callback();
    }

    close() {
        if (this._socket) this._socket.destroy();
    }
}

// ---------------------------------------------------------------------------

const createServiceLogger = (serviceName) => {
    const logstashHost = process.env.LOGSTASH_HOST || 'localhost';
    const logstashPort = parseInt(process.env.LOGSTASH_PORT || '5000', 10);
    const isProduction = process.env.ENV === 'production';

    const logTransports = [
        new transports.Console({
            format: isProduction
                ? combine(timestamp(), errors({ stack: true }), json())
                : combine(colorize(), simple()),
        }),
    ];

    const logstashTransport = new LogstashTcpTransport({
        host: logstashHost,
        port: logstashPort,
    });
    logTransports.push(logstashTransport);

    const logger = createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: combine(traceContextFormat(), timestamp(), errors({ stack: true }), json()),
        defaultMeta: { service: serviceName },
        transports: logTransports,
        exceptionHandlers: [new transports.Console()],
        rejectionHandlers: [new transports.Console()],
    });

    return logger;
}

module.exports = { createServiceLogger };