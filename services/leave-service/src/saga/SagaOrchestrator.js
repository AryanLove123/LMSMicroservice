const { RABBIT_EXCHANGES, RABBIT_ROUTING_KEYS } = require('../../../../shared/constants/constant');
const { LEAVE_STATUS, SAGA_STATUS } = require('../../../../shared/constants/constant');
const { v4: uuidv4 } = require('uuid');
const LeaveRequest = require('../models/LeaveRequest');


class SagaOrchestrator {
    constructor(rabbitMQ, logger) {
        this.logger = logger;
        this.rabbitMQ = rabbitMQ;
    }

    async startApprovalSaga(LeaveRequest, comments) {
        const sagaId = uuidv4();
        LeaveRequest.reviewedAt = new Date();
        LeaveRequest.reviewComments = comments || null;
        LeaveRequest.sagaId = sagaId;
        LeaveRequest.sagaStatus = SAGA_STATUS.STARTED;
        await LeaveRequest.save();

        this.logger.info('[SagaOrchestrator] Saga started (approval)', {
            sagaId,
            leaveId: LeaveRequest._id,
            employeeId: LeaveRequest.employeeId,
        });

        try {
            await this.rabbitMQ.publish(
                RABBIT_EXCHANGES.SAGA_EVENTS,
                RABBIT_ROUTING_KEYS.SAGA_DEDUCT_BALANCE,
                {
                    sagaId,
                    leaveId: LeaveRequest._id,
                    employeeId: LeaveRequest.employeeId,
                    numberOfDays: LeaveRequest.numberOfDays,
                    leaveType: LeaveRequest.leaveType,
                }
            );
            this.logger.info('[SagaOrchestrator] Approval event published to RabbitMQ', { sagaId, leaveId: LeaveRequest._id });
        } catch (error) {
            this.logger.error('[SagaOrchestrator] Failed to publish approval event to RabbitMQ', { sagaId, leaveId: LeaveRequest._id, error: error.message });
            await this._compensateApproval(LeaveRequest, 'Failed to send balance deduction command');
        }
    }

    async startRejectionSaga(LeaveRequest, comments) {
        const sagaId = uuidv4();
        LeaveRequest.status = LEAVE_STATUS.REJECTED;
        LeaveRequest.reviewedAt = new Date();
        LeaveRequest.reviewComments = comments || null;
        LeaveRequest.sagaStatus = SAGA_STATUS.COMPLETED;
        await LeaveRequest.save();

        try {
            await this.rabbitMQ.publish(
                RABBIT_EXCHANGES.NOTIFICATION_EVENTS,
                RABBIT_ROUTING_KEYS.NOTIFY_LEAVE_REJECTION,
                {
                    sagaId,
                    leaveId:       LeaveRequest._id,
                    employeeId:    LeaveRequest.employeeId,
                    employeeName:  LeaveRequest.employeeName,
                    employeeEmail: LeaveRequest.employeeEmail,
                    leaveType:     LeaveRequest.leaveType,
                    startDate:     LeaveRequest.startDate,
                    endDate:       LeaveRequest.endDate,
                    numberOfDays:  LeaveRequest.numberOfDays,
                    reason:        LeaveRequest.reason,
                    reviewComments: LeaveRequest.reviewComments,
                }
            );
            this.logger.info('[SagaOrchestrator] Rejection event published for notification to RabbitMQ', { sagaId, leaveId: LeaveRequest._id });
        } catch (error) {
            this.logger.error('[SagaOrchestrator] Failed to publish rejection event for notification to RabbitMQ', { sagaId, leaveId: LeaveRequest._id, error: error.message });
        }

        this.logger.info('[SagaOrchestrator] Saga completed (rejection)', {
            leaveId: LeaveRequest._id,
            employeeId: LeaveRequest.employeeId,
        });
        return LeaveRequest;
    }

    //Compensating Transaction in case of failure in approval saga
    async _compensateApproval(LeaveRequest, reason) {
        LeaveRequest.status = LEAVE_STATUS.PENDING;
        LeaveRequest.sagaStatus = SAGA_STATUS.COMPENSATING;
        LeaveRequest.reviewedAt = null;

        // If the leave was trimmed before the saga started, restore the original
        if (LeaveRequest.originalStartDate) {
            LeaveRequest.startDate = LeaveRequest.originalStartDate;
            LeaveRequest.numberOfDays = LeaveRequest.originalNumberOfDays;
            LeaveRequest.originalStartDate = null;
            LeaveRequest.originalNumberOfDays = null;
            LeaveRequest.trimNote = null;
        }
        await LeaveRequest.save();
        this.logger.warn('[SagaOrchestrator] Compensation complete — leave reverted to PENDING', {
            sagaId: LeaveRequest.sagaId,
            leaveId: LeaveRequest._id,
            employeeId: LeaveRequest.employeeId,
            reason,
        });
    }


    async handleDeductSuccess(sagaId, leaveId) {
        const leaveRequest = await LeaveRequest.findById(leaveId);
        if (!leaveRequest) {
            this.logger.error('[SagaOrchestrator] Leave request not found for deduction success handling', { sagaId, leaveId });
            return;
        }
        leaveRequest.sagaStatus = SAGA_STATUS.COMPLETED;
        await leaveRequest.save();

        await this.rabbitMQ.publish(
            RABBIT_EXCHANGES.NOTIFICATION_EVENTS,
            RABBIT_ROUTING_KEYS.NOTIFY_LEAVE_APPROVAL,
            {
                sagaId,
                leaveId,
                employeeId:    leaveRequest.employeeId,
                employeeName:  leaveRequest.employeeName,
                employeeEmail: leaveRequest.employeeEmail,
                leaveType:     leaveRequest.leaveType,
                startDate:     leaveRequest.startDate,
                endDate:       leaveRequest.endDate,
                numberOfDays:  leaveRequest.numberOfDays,
                reason:        leaveRequest.reason,
            }
        );
        this.logger.info('[SagaOrchestrator] Saga completed successfully', { sagaId, leaveId });
    }

    async handleDeductFailure(sagaId, leaveId, reason) {
        const leaveRequest = await LeaveRequest.findById(leaveId);
        if (!leaveRequest) {
            this.logger.error('[SagaOrchestrator] Leave request not found for deduction failure handling', { sagaId, leaveId });
            return;
        }
        await this._compensateApproval(leaveRequest, reason);
    }
}

module.exports = SagaOrchestrator;