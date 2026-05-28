const LeaveRequest = require('../models/LeaveRequest');
const AppError = require('../../../../shared/utils/AppError');
const { LEAVE_STATUS, RABBIT_EXCHANGES, RABBIT_ROUTING_KEYS } = require('../../../../shared/constants/constant');

class LeaveService {
  constructor(logger, rabbitMQ, empClient, sagaOrchestrator) {
    this.logger = logger;
    this.rabbitMQ = rabbitMQ;
    this.empClient = empClient;
    this.sagaOrchestrator = sagaOrchestrator;
  }

  requestLeave = async (user, leaveData) => {
    console.log("Thissss isss user", user);
    const employeeResponse = await this.empClient.get('/employees/profile', user.rawToken)
      .catch(err => {
        this.logger.error('Failed to fetch employee profile', { userId: user.userId, error: err.message });
        throw AppError.serviceUnavailable('Failed to fetch employee profile. Please try again later.');
      });
    const employee = employeeResponse.data;

    if (!employee.managerId) {
      throw AppError.badRequest('No manager assigned. Contact Admin before applying for leave.');
    }

    const { leaveType, startDate, endDate, reason } = leaveData;
    const start = new Date(startDate);
    const end = new Date(endDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      throw AppError.badRequest('Start date cannot be in the past');
    }
    if (end < start) {
      throw AppError.badRequest('End date cannot be before start date');
    }

    const overlap = await LeaveRequest.findOverlappingLeaves(user.userId, start, end);
    if (overlap) {
      throw AppError.conflict(
        `Overlapping leave (${overlap.status}) from ${overlap.startDate.toDateString()} to ${overlap.endDate.toDateString()}`
      );
    }

    const leaveBalanceResult = await this.empClient.get(`/employees/${user.userId}/leave-balance`, user.rawToken)
      .catch(err => {
        this.logger.error('Failed to fetch leave balance', { userId: user.userId, error: err.message });
        throw AppError.serviceUnavailable('Failed to fetch leave balance. Please try again later.');
      });
    const leaveBalances = leaveBalanceResult.data;
    const balance = leaveBalances.find(lb => lb.type === leaveType);

    const requestedDays = this.calculateWorkingDays(start, end);

    if (!balance || requestedDays > balance.remaining) {
      throw AppError.badRequest(`Insufficient leave balance for ${leaveType}. Available: ${balance ? balance.remaining : 0} days and requested: ${requestedDays} days.`);
    }

    const leaveRequest = await LeaveRequest.create({
      employeeId: employee.userId,
      managerId: employee.managerId,
      leaveType,
      startDate,
      endDate,
      requestedDays,
      reason,
      status: LEAVE_STATUS.PENDING,
    });
    if (this.rabbitMQ) {
      await this.rabbitMQ.publish(RABBIT_EXCHANGES.LEAVE_EVENTS,
        RABBIT_ROUTING_KEYS.LEAVE_REQUESTED,
        {
          leaveRequestId: leaveRequest._id,
          employeeId: employee.userId,
          managerId: employee.managerId,
          leaveType,
          startDate,
          endDate,
          reason,
          requestedDays,
          status: LEAVE_STATUS.PENDING,
        },
      );
    }
    return leaveRequest;
  }

  reviewLeave = async (managerId, leaveRequestId, reviewData) => {
    const today = new Date();
    const leaveRequest = await LeaveRequest.findOne({
      _id: leaveRequestId,
      status: LEAVE_STATUS.PENDING,
    });
    if (!leaveRequest) {
      throw AppError.notFound('Leave request not found or already reviewed');
    }
    if (leaveRequest.managerId !== managerId) {
      throw AppError.forbidden('You are not authorized to review this leave request');
    }

    const { action , comments } = reviewData;

    if(action === 'approve') {
      today.setHours(0, 0, 0, 0);
      if (leaveRequest.startDate < today) {
        const effectiveStart = new Date(today);
        const effectiveDays = this.calculateWorkingDays(effectiveStart, leaveRequest.endDate);

        if (effectiveDays < 1) {
          // Every day of this leave has already passed — manager must reject it
          throw AppError.conflict(
            'All days of this leave request have already passed. ' +
            'Please reject it and ask the employee to re-apply if needed.'
          );
        }

        // Preserve originals for audit, then trim the live fields
        leaveRequest.originalStartDate = leaveRequest.startDate;
        leaveRequest.originalNumberOfDays = leaveRequest.numberOfDays;
        leaveRequest.trimNote =
          `Start date adjusted from ${leaveRequest.startDate.toDateString()} to ` +
          `${effectiveStart.toDateString()} at approval time. ` +
          `${leaveRequest.numberOfDays - effectiveDays} previously-passed day(s) excluded.`;

        leaveRequest.startDate = effectiveStart;
        leaveRequest.numberOfDays = effectiveDays;

        this.logger.info('[LeaveService] Stale leave trimmed on approval', {
          leaveId: leaveRequest._id,
          originalStart: leaveRequest.originalStartDate,
          effectiveStart,
          originalDays: leaveRequest.originalNumberOfDays,
          effectiveDays,
        });
      }

      return this.sagaOrchestrator.startApprovalSaga(leaveRequest, comments);

    } else if(action === 'reject') {
      return this.sagaOrchestrator.startRejectionSaga(leaveRequest, comments);
    } else {
      throw AppError.badRequest('Invalid action. Must be either "approve" or "reject".');
    } 
  }

  calculateWorkingDays(start, end) {
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return (end - start) / (1000 * 60 * 60 * 24);
  }
}

module.exports = LeaveService;