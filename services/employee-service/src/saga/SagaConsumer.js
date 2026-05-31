const { RABBIT_QUEUES, RABBIT_EXCHANGES, RABBIT_ROUTING_KEYS } = require('../../../../shared/constants/constant');
const { withSpan } = require('../../../../shared/utils/tracer');
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

        await this.rabbitMQ.subscribe(
            RABBIT_QUEUES.SAGA_RESTORE_BALANCE,
            RABBIT_EXCHANGES.SAGA_EVENTS,
            RABBIT_ROUTING_KEYS.SAGA_RESTORE_BALANCE,
            (msg) => this.handleRestoreBalance(msg.sagaId, msg.leaveId, msg.employeeId, msg.numberOfDays, msg.leaveType)
        );
        this.logger.info('[SagaConsumer] Started listening to saga events');
    }

    async handleDeductBalance(sagaId, leaveId, employeeId, numberOfDays, leaveType) {
        return withSpan('employee-service', 'saga.deduct.balance', {
            'saga.id': sagaId, 'leave.id': leaveId, 'employee.id': employeeId, 'leave.type': leaveType, 'leave.days': numberOfDays
        }, async (span) => {
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
                span.recordException(error);
                await this.rabbitMQ.publish(
                    RABBIT_EXCHANGES.SAGA_EVENTS,
                    RABBIT_ROUTING_KEYS.SAGA_DEDUCT_FAILURE,
                    { sagaId, leaveId, employeeId, leaveType, numberOfDays, reason: error.message }
                );
            }
        });
    }

    async handleRestoreBalance(sagaId, leaveId, employeeId, numberOfDays, leaveType) {
        return withSpan('employee-service', 'saga.restore.balance', {
            'saga.id': sagaId, 'leave.id': leaveId, 'employee.id': employeeId, 'leave.type': leaveType, 'leave.days': numberOfDays
        }, async (span) => {
            this.logger.info('[SagaConsumer] Received balance restore command', { sagaId, leaveId, employeeId, numberOfDays, leaveType });      
            try {
                await this.empService.restoreLeave(employeeId, leaveType, numberOfDays);
                this.logger.info('[SagaConsumer] Balance restore successful', { sagaId, leaveId });
            }
            catch (error) {
                this.logger.error('[SagaConsumer] Balance restore failed', { sagaId, leaveId, error: error.message });
                span.recordException(error);
            }
        });
    }
}

module.exports = SagaConsumer;