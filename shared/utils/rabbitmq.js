const amqp = require('amqplib');
const { RABBIT_EXCHANGES } = require('../constants/constant');
const { injectTraceContext } = require('./tracer');
class RabbitMQManager {
  constructor(logger) {
    this.logger     = logger;
    this.connection = null;
    this.channel    = null;
    this.uri        = null;
    this._reconnecting = false;
    this._closing      = false;  // set to true during intentional shutdown
  }

  async connect(uri) {
    this.uri = uri;
    await this._connect();
  }

  async _connect() {
    try {
      this.connection = await amqp.connect(this.uri);
      this.channel    = await this.connection.createChannel();
      await this._setupTopology();

      this.connection.on('error', (err) => {
        this.logger.error('[RabbitMQ] Connection error', { error: err.message });
        this._scheduleReconnect();
      });
      this.connection.on('close', () => {
        this.logger.warn('[RabbitMQ] Connection closed');
        this._scheduleReconnect();
      });

      this.logger.info('[RabbitMQ] Connected');
    } catch (err) {
      this.logger.error('[RabbitMQ] Failed to connect', { error: err.message });
      this._scheduleReconnect();
    }
  }

  async _setupTopology() {
    for (const exchange of Object.values(RABBIT_EXCHANGES)) {
      await this.channel.assertExchange(exchange, 'topic', { durable: true });
    }
  }

  _scheduleReconnect() {
    if (this._reconnecting || this._closing) return;  // don't reconnect after intentional close
    this._reconnecting = true;
    setTimeout(async () => {
      this._reconnecting = false;
      await this._connect();
    }, 5000);
  }

  async publish(exchange, routingKey, payload) {
    if (!this.channel) throw new Error('RabbitMQ channel not ready');
    const buffer = Buffer.from(JSON.stringify({ ...payload, routingKey }));

    //build carrier headers and inject trace context if available
    const carrierHeaders = {};
    injectTraceContext(carrierHeaders);

    this.channel.publish(exchange, routingKey, buffer, {
      persistent:   true,
      contentType:  'application/json',
      timestamp:    Date.now(),
      headers:      carrierHeaders,
    });
    this.logger.debug('[RabbitMQ] Published', { exchange, routingKey });
  }

  // Graceful shutdown: closes channel + connection and suppresses the reconnect timer.
  async close() {
    this._closing = true;
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
    } catch (err) {
      // Log but don't throw — we're shutting down anyway
      this.logger.error('[RabbitMQ] Error during close', { error: err.message });
    }
  }

  async subscribe(queue, exchange, pattern, handler) {
    if (!this.channel) throw new Error('RabbitMQ channel not ready');

    // Dead-letter exchange setup
    const dlxName  = `${queue}.dlx`;
    const dlqName  = `${queue}.dead`;
    await this.channel.assertExchange(dlxName, 'fanout', { durable: true });
    await this.channel.assertQueue(dlqName, { durable: true });
    await this.channel.bindQueue(dlqName, dlxName, '#');

    await this.channel.assertQueue(queue, {
      durable:   true,
      arguments: {
        'x-dead-letter-exchange': dlxName,
        'x-message-ttl':          86400000, // 24h
      },
    });
    await this.channel.bindQueue(queue, exchange, pattern);
    this.channel.prefetch(1);

    this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        // AmqplibInstrumentation automatically extracts the trace context from
        // msg.properties.headers and sets it as the active span context before
        // calling this callback. Do NOT override that context manually —
        // doing so orphans the auto-created 'process' span in Jaeger.
        await handler(content);
        this.channel.ack(msg);
      } catch (err) {
        this.logger.error('[RabbitMQ] Handler error — moving to DLQ', {
          queue,
          error: err.message,
        });
        this.channel.nack(msg, false, false); // → DLQ
      }
    });

    this.logger.info('[RabbitMQ] Subscribed', { queue, exchange, pattern });
  }
}

module.exports = RabbitMQManager;
