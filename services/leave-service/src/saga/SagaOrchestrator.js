const { RABBIT_EXCHANGES, RABBIT_ROUTING_KEYS } = require('../../../../shared/constants/constant');
const { LEAVE_STATUS, SAGA_STATUS } = require('../../../../shared/constants/constant');
const { v4: uuidv4 } = require('uuid');
const LeaveRequest = require('../models/LeaveRequest');
const { withSpan } = require('../../../../shared/utils/tracer');

class SagaOrchestrator {
    constructor(rabbitMQ, logger) {
        this.logger = logger;
        this.rabbitMQ = rabbitMQ;
    }

    /**
     * The entire saga is wrapped in a 'saga.approval.start' span so Jaeger
     * shows it as a single named operation with sagaId, leaveId etc. as tags.
    **/
    async startApprovalSaga(LeaveRequest, comments) {
        const sagaId = uuidv4();

        return withSpan('leave-service', 'saga.approval.start', {
            'saga.id': sagaId, 'leave.id': LeaveRequest._id, 'employee.id': LeaveRequest.employeeId, 'leave.type': LeaveRequest.leaveType, 'leave.days': LeaveRequest.numberOfDays
        }, async (span) => {
            LeaveRequest.status = LEAVE_STATUS.APPROVED;
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
                span.recordException(error);
                await this._compensateApproval(LeaveRequest, 'Failed to send balance deduction command');
            }
            return LeaveRequest;
        });
    }

    async startRejectionSaga(LeaveRequest, comments) {
        const sagaId = uuidv4();
        return withSpan('leave-service', 'saga.rejection.complete', {
            'saga.id': sagaId, 'leave.id': LeaveRequest._id, 'employee.id': LeaveRequest.employeeId, 'leave.type': LeaveRequest.leaveType, 'leave.days': LeaveRequest.numberOfDays
        }, async (span) => {
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
                        leaveId: LeaveRequest._id,
                        employeeId: LeaveRequest.employeeId,
                        employeeName: LeaveRequest.employeeName,
                        employeeEmail: LeaveRequest.employeeEmail,
                        leaveType: LeaveRequest.leaveType,
                        startDate: LeaveRequest.startDate,
                        endDate: LeaveRequest.endDate,
                        numberOfDays: LeaveRequest.numberOfDays,
                        reason: LeaveRequest.reason,
                        reviewComments: LeaveRequest.reviewComments,
                    }
                );
                this.logger.info('[SagaOrchestrator] Rejection event published for notification to RabbitMQ', { sagaId, leaveId: LeaveRequest._id });
            } catch (error) {
                span.recordException(error);
                this.logger.error('[SagaOrchestrator] Failed to publish rejection event for notification to RabbitMQ', { sagaId, leaveId: LeaveRequest._id, error: error.message });
            }

            this.logger.info('[SagaOrchestrator] Saga completed (rejection)', {
                leaveId: LeaveRequest._id,
                employeeId: LeaveRequest.employeeId,
            });
            return LeaveRequest;
        });
    }

    //Compensating Transaction in case of failure in approval saga.
    // Pass restoreBalance=true ONLY when balance was already deducted (i.e. employee service
    // confirmed success before a downstream failure). In current implementation both callers
    // invoke this before deduction succeeds, so restoreBalance defaults to false.
    async _compensateApproval(LeaveRequest, reason, restoreBalance = false) {
        return withSpan('leave-service', 'saga.compensation', {
            'saga.id': LeaveRequest.sagaId || '',
            'leave.id': String(LeaveRequest._id),
            'employee.id': LeaveRequest.employeeId,
            'compensation.reason': reason,
            'restore.balance': restoreBalance,
        }, async (span) => {
            LeaveRequest.status = LEAVE_STATUS.PENDING;
            LeaveRequest.sagaStatus = SAGA_STATUS.COMPENSATING;
            LeaveRequest.reviewedAt = null;

            // If the leave was trimmed before the saga started, restore the original dates
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

            // Only publish restore-balance if the balance was actually deducted first
            if (restoreBalance && LeaveRequest.numberOfDays) {
                try {
                    await this.rabbitMQ.publish(
                        RABBIT_EXCHANGES.SAGA_EVENTS,
                        RABBIT_ROUTING_KEYS.SAGA_RESTORE_BALANCE,
                        {
                            sagaId: LeaveRequest.sagaId,
                            leaveId: LeaveRequest._id,
                            employeeId: LeaveRequest.employeeId,
                            leaveType: LeaveRequest.leaveType,
                            numberOfDays: LeaveRequest.numberOfDays,
                        }
                    );
                    this.logger.info('[SagaOrchestrator] Restore-balance command published', { sagaId: LeaveRequest.sagaId });
                } catch (pubErr) {
                    span.recordException(pubErr);
                    this.logger.error('[SagaOrchestrator] Failed to publish restore-balance command', { error: pubErr.message });
                }
            }
        });
    }


    async handleDeductSuccess(sagaId, leaveId) {
        return withSpan('leave-service', 'saga.approval.complete', {
            'saga.id': sagaId, 'leave.id': leaveId
        }, async (span) => {
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
                    employeeId: leaveRequest.employeeId,
                    employeeName: leaveRequest.employeeName,
                    employeeEmail: leaveRequest.employeeEmail,
                    leaveType: leaveRequest.leaveType,
                    startDate: leaveRequest.startDate,
                    endDate: leaveRequest.endDate,
                    numberOfDays: leaveRequest.numberOfDays,
                    reason: leaveRequest.reason,
                }
            );
            this.logger.info('[SagaOrchestrator] Saga completed successfully', { sagaId, leaveId });
        });
    }

    async handleDeductFailure(sagaId, leaveId, reason) {
        return withSpan('leave-service', 'saga.approval.compensate', {
            'saga.id': sagaId, 'leave.id': leaveId, 'compensation.reason': reason
        }, async (span) => {
            const leaveRequest = await LeaveRequest.findById(leaveId);
            if (!leaveRequest) {
                this.logger.error('[SagaOrchestrator] Leave request not found for deduction failure handling', { sagaId, leaveId });
                return;
            }
            this.logger.warn('[SagaOrchestrator] Handling deduction failure, initiating compensation', { sagaId, leaveId, reason });
            await this._compensateApproval(leaveRequest, reason);
        });
    }
}

module.exports = SagaOrchestrator;