const amqp = require('amqplib');
const { RABBIT_EXCHANGES } = require('../constants/constant');

class RabbitMQManager {
  constructor(logger) {
    this.logger     = logger;
    this.connection = null;
    this.channel    = null;
    this.uri        = null;
    this._reconnecting = false;
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
    if (this._reconnecting) return;
    this._reconnecting = true;
    setTimeout(async () => {
      this._reconnecting = false;
      await this._connect();
    }, 5000);
  }

  async publish(exchange, routingKey, payload) {
    if (!this.channel) throw new Error('RabbitMQ channel not ready');
    const buffer = Buffer.from(JSON.stringify({ ...payload, routingKey }));
    this.channel.publish(exchange, routingKey, buffer, {
      persistent:   true,
      contentType:  'application/json',
      timestamp:    Date.now(),
    });
    this.logger.debug('[RabbitMQ] Published', { exchange, routingKey });
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
