const { RABBIT_QUEUES, RABBIT_EXCHANGES, RABBIT_ROUTING_KEYS } = require('../../../../shared/constants/constant');
class SagaConsumer {
    constructor(rabbitMQ, logger, empService) {
        this.rabbitMQ = rabbitMQ;
        this.logger = logger;
        this.empService = empService;
    }

    async startListening() {
        await this.rabbitMQ.subscribe(
            RABBIT_QUEUES.SAGA_DEDUCT_BALANCE,
            RABBIT_EXCHANGES.SAGA_EVENTS,
            RABBIT_ROUTING_KEYS.SAGA_DEDUCT_BALANCE,
            (msg) => this.handleDeductBalance(msg.sagaId, msg.leaveId, msg.employeeId, msg.numberOfDays, msg.leaveType)
        );
        this.logger.info('[SagaConsumer] Started listening to saga events');
    }

    async handleDeductBalance(sagaId, leaveId, employeeId, numberOfDays, leaveType) {
        this.logger.info('[SagaConsumer] Received balance deduction command', { sagaId, leaveId, employeeId, numberOfDays, leaveType });
        try {
            await this.empService.deductLeave(employeeId, leaveType, numberOfDays);
            await this.rabbitMQ.publish(
                RABBIT_EXCHANGES.SAGA_EVENTS,
                RABBIT_ROUTING_KEYS.SAGA_DEDUCT_SUCCESS,
                { sagaId, leaveId, employeeId, leaveType, numberOfDays }
            );
            this.logger.info('[SagaConsumer] Balance deduction successful, published deduction success event', { sagaId, leaveId });
        }
        catch (error) {
            this.logger.error('[SagaConsumer] Balance deduction failed, publishing compensation event', { sagaId, leaveId, error: error.message });
            await this.rabbitMQ.publish(
                RABBIT_EXCHANGES.SAGA_EVENTS,
                RABBIT_ROUTING_KEYS.SAGA_DEDUCT_FAILURE,
                { sagaId, leaveId, employeeId, leaveType, numberOfDays, reason: error.message }
            );
        }
    }
}

module.exports = SagaConsumer;