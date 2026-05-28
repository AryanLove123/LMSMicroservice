const { RABBIT_QUEUES, RABBIT_EXCHANGES, RABBIT_ROUTING_KEYS } = require('../../../../shared/constants/constant');
class SagaReplyConsumer {
    constructor(rabbitMQ, logger, sagaOrchestrator) {
        this.rabbitMQ = rabbitMQ;
        this.sagaOrchestrator = sagaOrchestrator;
        this.logger = logger;
    }

    async startListening() {
        await this.rabbitMQ.subscribe(
            RABBIT_QUEUES.SAGA_DEDUCT_SUCCESS,
            RABBIT_EXCHANGES.SAGA_EVENTS,
            RABBIT_ROUTING_KEYS.SAGA_DEDUCT_SUCCESS,
            (msg) => this.handleDeductSuccess(msg)
        );

        await this.rabbitMQ.subscribe(
            RABBIT_QUEUES.SAGA_DEDUCT_FAILURE,
            RABBIT_EXCHANGES.SAGA_EVENTS,
            RABBIT_ROUTING_KEYS.SAGA_DEDUCT_FAILURE,
            (msg) => this.handleDeductFailure(msg)
        );
        this.logger.info('[SagaReplyConsumer] Started listening for saga reply events');
    }

    async handleDeductSuccess(msg) {
        const { sagaId, leaveId } = msg;
        this.logger.info('[SagaReplyConsumer] Received balance deduction success event', { sagaId, leaveId });
        await this.sagaOrchestrator.handleDeductSuccess(sagaId, leaveId);
    }

    async handleDeductFailure(msg) {
        const { sagaId, leaveId, reason } = msg;
        this.logger.warn('[SagaReplyConsumer] Received balance deduction failure event, triggering compensation', { sagaId, reason });
        await this.sagaOrchestrator.handleDeductFailure(sagaId, leaveId, reason);
    }
}

module.exports = SagaReplyConsumer;