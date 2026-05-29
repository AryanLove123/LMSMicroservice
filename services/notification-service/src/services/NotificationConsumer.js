const { RABBIT_QUEUES, RABBIT_EXCHANGES, RABBIT_ROUTING_KEYS } = require('../../../../shared/constants/constant');

class NotificationConsumer {
    constructor(rabbitMQ, logger, notificationService) {
        this.rabbitMQ = rabbitMQ;
        this.logger = logger;
        this.notificationService = notificationService;
    }

    async startListening() {
        await this.rabbitMQ.subscribe(
            RABBIT_QUEUES.LEAVE_REQUESTED,
            RABBIT_EXCHANGES.LEAVE_EVENTS,
            RABBIT_ROUTING_KEYS.LEAVE_REQUESTED,
            (msg) => this.handleLeaveRequested(msg)
        );

        await this.rabbitMQ.subscribe(
            RABBIT_QUEUES.NOTIFY_LEAVE_APPROVAL,
            RABBIT_EXCHANGES.NOTIFICATION_EVENTS,
            RABBIT_ROUTING_KEYS.NOTIFY_LEAVE_APPROVAL,
            (msg) => this.handleLeaveApproval(msg)
        );

        await this.rabbitMQ.subscribe(
            RABBIT_QUEUES.NOTIFY_LEAVE_REJECTION,
            RABBIT_EXCHANGES.NOTIFICATION_EVENTS,
            RABBIT_ROUTING_KEYS.NOTIFY_LEAVE_REJECTION,
            (msg) => this.handleLeaveRejection(msg)
        );
        this.logger.info('[NotificationConsumer] Started listening for notification events');
    }

    async handleLeaveRequested(msg) {
        this.logger.info('[NotificationConsumer] Received leave requested event', { msg }); 
        try {
            await this.notificationService.notifyManagerOfLeaveRequest(msg);
        } catch (error) {
            this.logger.error('[NotificationConsumer] Error handling leave requested event', { error: error.message, msg });
            throw error;
        }
    }

    async handleLeaveApproval(msg) {
        this.logger.info('[NotificationConsumer] Received leave approval event', { msg }); 
        try {
            await this.notificationService.notifyEmployeeOfLeaveApproval(msg);
        } catch (error) {
            this.logger.error('[NotificationConsumer] Error handling leave approval event', { error: error.message, msg });
            throw error;
        }
    }   

    async handleLeaveRejection(msg) {
        this.logger.info('[NotificationConsumer] Received leave rejection event', { msg });
        try {
            await this.notificationService.notifyEmployeeOfLeaveRejection(msg);
        } catch (error) {
            this.logger.error('[NotificationConsumer] Error handling leave rejection event', { error: error.message, msg });
            throw error;
        }
    }
}

module.exports = NotificationConsumer;