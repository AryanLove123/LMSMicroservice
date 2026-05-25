const { RABBIT_EXCHANGES, RABBIT_ROUTING_KEYS, RABBIT_QUEUES } = require('../../../../shared/constants/constant');

class UserCreatedConsumer {
    constructor(empService, mqManager, logger) {
        this.empService = empService;
        this.mqManager = mqManager;
        this.logger = logger;
    }

    async startListening() {
        await this.mqManager.subscribe(
            RABBIT_QUEUES.USER_CREATED,
            RABBIT_EXCHANGES.USER_EVENTS,
            RABBIT_ROUTING_KEYS.USER_CREATED,
            (msg) => this.handleUserCreated(msg)
        );
        this.logger.info('[UserCreatedConsumer] Started listening for user created events');
    }

    handleUserCreated = async (user) => {
        try {
            this.logger.info(`[UserCreatedConsumer] Received user created event for user: ${user.userId}`);
            await this.empService.createEmployee(user);
        } catch (error) {
            this.logger.error(`[UserCreatedConsumer] Error handling user created event: ${error.message}`);
            throw error; // Let the message broker handle retries
        }
        
    }
}

module.exports = { UserCreatedConsumer };