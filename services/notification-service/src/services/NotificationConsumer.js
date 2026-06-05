const { RABBIT_QUEUES, RABBIT_EXCHANGES, RABBIT_ROUTING_KEYS } = require('../../../../shared/constants/constant');

class NotificationConsumer {
    constructor(rabbitMQ, logger, notificationService) {
        this.rabbitMQ = rabbitMQ;
        this.logger = logger;
        this.notificationService = notificationService;
    }

    async startListening() {
        await this.rabbitMQ.subscribe(
            RABBIT_QUEUES.NOTIFY_LEAVE_REQUESTED,
            RABBIT_EXCHANGES.NOTIFICATION_EVENTS,
            RABBIT_ROUTING_KEYS.NOTIFY_LEAVE_REQUESTED,
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

        await this.rabbitMQ.subscribe(
            RABBIT_QUEUES.NOTIFY_LEAVE_CANCELLATION,
            RABBIT_EXCHANGES.NOTIFICATION_EVENTS,
            RABBIT_ROUTING_KEYS.NOTIFY_LEAVE_CANCELLATION,
            (msg) => this.handleLeaveCancellation(msg)
        );

        await this.rabbitMQ.subscribe(
            RABBIT_QUEUES.NOTIFY_APPROVAL_FAILURE,
            RABBIT_EXCHANGES.NOTIFICATION_EVENTS,
            RABBIT_ROUTING_KEYS.NOTIFY_APPROVAL_FAILURE,
            (msg) => this.handleLeaveApprovalFailure(msg)
        );
        this.logger.info('[NotificationConsumer] Started listening for notification events');
    }

     handleLeaveRequested = async (msg) => {
        this.logger.info('[NotificationConsumer] Received leave requested event', { msg }); 
        try {
            await this.notificationService.notifyManagerOfLeaveRequest(msg);
        } catch (error) {
            this.logger.error('[NotificationConsumer] Error handling leave requested event', { error: error.message, msg });
            throw error;
        }
    }

    handleLeaveApproval = async (msg) => {
        this.logger.info('[NotificationConsumer] Received leave approval event', { msg }); 
        try {
            await this.notificationService.notifyEmployeeOfLeaveApproval(msg);
        } catch (error) {
            this.logger.error('[NotificationConsumer] Error handling leave approval event', { error: error.message, msg });
            throw error;
        }
    }   

    handleLeaveRejection = async (msg) => {
        this.logger.info('[NotificationConsumer] Received leave rejection event', { msg });
        try {
            await this.notificationService.notifyEmployeeOfLeaveRejection(msg);
        } catch (error) {
            this.logger.error('[NotificationConsumer] Error handling leave rejection event', { error: error.message, msg });
            throw error;
        }
    }

    handleLeaveCancellation = async (msg) => {
        this.logger.info('[NotificationConsumer] Received leave cancellation event', { msg });
        try {
            await this.notificationService.notifyEmployeeOfLeaveCancellation(msg);
        } catch (error) {
            this.logger.error('[NotificationConsumer] Error handling leave cancellation event', { error: error.message, msg });
            throw error;
        }
    }

    handleLeaveApprovalFailure = async (msg) => {
        this.logger.info('[NotificationConsumer] Received leave approval failure event', { msg });
        try {
            await this.notificationService.notifyEmployeeOfLeaveApprovalFailure(msg);
        } catch (error) {
            this.logger.error('[NotificationConsumer] Error handling leave approval failure event', { error: error.message, msg });
            throw error;
        }
    }
}

module.exports = NotificationConsumer;