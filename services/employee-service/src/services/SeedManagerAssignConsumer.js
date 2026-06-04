const {RABBIT_EXCHANGES,RABBIT_ROUTING_KEYS,RABBIT_QUEUES} = require('../../../../shared/constants/constant');
const { Employee } = require('../models/Employee');

class SeedManagerAssignConsumer {
    constructor(mqManager, logger) {
        this.mqManager = mqManager;
        this.logger = logger;
    }

    async startListening() {
        await this.mqManager.subscribe(
            RABBIT_QUEUES.SEED_MANAGER_ASSIGN,
            RABBIT_EXCHANGES.USER_EVENTS,
            RABBIT_ROUTING_KEYS.SEED_MANAGER_ASSIGN,
            (msg) => this.handle(msg)
        );
        this.logger.info('[SeedManagerAssignConsumer] Listening for seed.manager.assign events');
    }

    handle = async ({ employeeUserId, managerUserId }) => {
        this.logger.info(
            `[SeedManagerAssignConsumer] Received — ` +
            `employee: ${employeeUserId}, manager: ${managerUserId}`
        );

        const manager  = await this.waitForEmployee(managerUserId, 'manager');
        const empRecord = await this.waitForEmployee(employeeUserId, 'employee');

        if (empRecord.managerId) {
            this.logger.info(
                `[SeedManagerAssignConsumer] managerId already set for ${employeeUserId} — skipping`
            );
            return;
        }

        if (manager.role !== 'manager') {
            throw new Error(
                `[SeedManagerAssignConsumer] userId ${managerUserId} is not a manager`
            );
        }

        //Assign managerId and save
        empRecord.managerId   = manager.userId;
        await empRecord.save();

        this.logger.info(
            `[SeedManagerAssignConsumer] Manager assigned ✓ — ` +
            `employee: ${employeeUserId} → manager: ${managerUserId}`
        );
    };

    // Polls the local employee DB until the record appears.
    async waitForEmployee(userId, label, timeoutMs = 30_000, intervalMs = 1_000) {
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            const record = await Employee.findOne({ userId });
            if (record) return record;

            this.logger.info(
                `[SeedManagerAssignConsumer] Waiting for ${label} record (userId: ${userId})…`
            );
            await new Promise((r) => setTimeout(r, intervalMs));
        }

        throw new Error(
            `[SeedManagerAssignConsumer] Timed out waiting for ${label} — userId: ${userId}`
        );
    }
}

module.exports = SeedManagerAssignConsumer;