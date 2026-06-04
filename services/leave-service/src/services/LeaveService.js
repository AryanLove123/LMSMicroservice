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
    const employeeResponse = await this.empClient.get('/api/employees/profile', user.rawToken)
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

    const leaveBalances = employee.leaveBalances;
    this.logger.info('Fetched leave balances for employee', { userId: user.userId, leaveBalances });
    const balance = leaveBalances.find(lb => lb.type === leaveType);

    const requestedDays = this.calculateWorkingDays(start, end);

    if (!balance || requestedDays > balance.remaining) {
      throw AppError.badRequest(`Insufficient leave balance for ${leaveType}. Available: ${balance ? balance.remaining : 0} days and requested: ${requestedDays} days.`);
    }

    const managerInfo = await this.empClient.internalGet(`/api/employees/internal/${employee.managerId}`)
      .catch(err => {
        this.logger.error('Failed to fetch manager profile', { managerId: employee.managerId, message: err.message, code: err.code, status: err.response?.status, data: err.response?.data });
        throw AppError.serviceUnavailable('Failed to fetch manager profile. Please try again later.');
      });

    const leaveRequest = await LeaveRequest.create({
      employeeId: employee.userId,
      managerId: employee.managerId,
      employeeName: employee.name,
      employeeEmail: employee.email,
      managerEmail: managerInfo.data.email || null,
      managerName: managerInfo.data.name || null,
      numberOfDays: requestedDays,
      leaveType,
      startDate,
      endDate,
      reason,
      status: LEAVE_STATUS.PENDING,
    });
    if (this.rabbitMQ) {
      await this.rabbitMQ.publish(RABBIT_EXCHANGES.NOTIFICATION_EVENTS,
        RABBIT_ROUTING_KEYS.NOTIFY_LEAVE_REQUESTED,
        {
          leaveRequestId: leaveRequest._id,
          employeeId: employee.userId,
          employeeName: employee.name,
          employeeEmail: employee.email,
          managerId: employee.managerId,
          managerEmail: managerInfo.data.email || null,
          managerName: managerInfo.data.name || null,
          leaveType,
          startDate,
          endDate,
          reason,
          numberOfDays: requestedDays,
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

    const { action, comments } = reviewData;

    if (action === 'approve') {
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

      const sagaResult = this.sagaOrchestrator.startApprovalSaga(leaveRequest, comments);
      return sagaResult;

    } else if (action === 'reject') {
      return this.sagaOrchestrator.startRejectionSaga(leaveRequest, comments);
    } else {
      throw AppError.badRequest('Invalid action. Must be either "approve" or "reject".');
    }
  }

  async cancelLeave(leaveRequestId, user, cancelData) {
    let previousStatus = LEAVE_STATUS.PENDING;
    console.log('Canceling leave request logss', { leaveRequestId, user: user, reason: cancelData });
    const leaveRequest = await LeaveRequest.findOne({
      _id: leaveRequestId,
      employeeId: user.userId,
      status: { $in: [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED] },
    });
    console.log('Leave request found for cancellation', { leaveRequest });
    if (!leaveRequest) {
      throw AppError.notFound('Leave request not found or cannot be canceled');
    }

    if (leaveRequest.employeeId !== user.userId) {
      throw AppError.forbidden('You can only cancel your own leave requests');
    }

    if (leaveRequest.status === LEAVE_STATUS.APPROVED && leaveRequest.startDate <= new Date()) {
      throw AppError.conflict('Cannot cancel a leave that has already started');
    }

    if ([LEAVE_STATUS.REJECTED, LEAVE_STATUS.CANCELLED].includes(leaveRequest.status)) {
      throw AppError.conflict(`Leave is already ${leaveRequest.status}`);
    }

    // If approved, restore the balance via Saga compensation
    console.log('Restoring leave balance via Saga compensation', { leaveRequest });
    if (leaveRequest.status === LEAVE_STATUS.APPROVED) {
      previousStatus = LEAVE_STATUS.APPROVED;
      await this.rabbitMQ.publish(
        RABBIT_EXCHANGES.SAGA_EVENTS,
        RABBIT_ROUTING_KEYS.SAGA_RESTORE_BALANCE,
        {
          sagaId: leaveRequest.sagaId || 'cancel',
          leaveId: leaveRequest._id.toString(),
          userId: leaveRequest.employeeId,
          numberOfDays: leaveRequest.numberOfDays,
          leaveType: leaveRequest.leaveType,
          reason: cancelData.reason,
        }
      );
    }
    leaveRequest.status = LEAVE_STATUS.CANCELLED;
    leaveRequest.cancelledAt = new Date();
    leaveRequest.cancelledReason = cancelData.reason;
    await leaveRequest.save();

    await this.rabbitMQ.publish(
      RABBIT_EXCHANGES.NOTIFICATION_EVENTS,
      RABBIT_ROUTING_KEYS.NOTIFY_LEAVE_CANCELLATION,
      {
        leaveId: leaveRequest._id.toString(),
        employeeId: leaveRequest.employeeId,
        reason: cancelData.reason,
        employeeName: leaveRequest.employeeName,
        employeeEmail: leaveRequest.employeeEmail,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        leaveType: leaveRequest.leaveType,
        numberOfDays: leaveRequest.numberOfDays,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        previousStatus,
      }
    );

  }

  getMyLeaves = async (employeeId, filters) => {
    const {page = 1, limit = 10, status, leaveType, startDate, endDate } = filters;

    let query = { };
    query.employeeId = employeeId;

    if (status) {
      const statuses = status.split(',').map(s => s.trim().toLowerCase());
      query.status = { $in: statuses };
    }

    if (leaveType) {
      query.leaveType = leaveType.toLowerCase();
    }

    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), 0, 1);

    const end = endDate
      ? new Date(endDate)
      : new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);

    query.startDate = { $lte: end };
    query.endDate = { $gte: start };

    const skip = (page - 1) * limit;
    const total = await LeaveRequest.countDocuments(query);

    const requests = await LeaveRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return {
      requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  getTeamLeaves = async (managerId, filters) => {
    const {
      page = 1,
      limit = 10,
      status,
      leaveType,
      employeeEmail,
      startDate,
      endDate,
    } = filters;

    const query = { managerId };

    if (status) {
      const statuses = status.split(',').map(s => s.trim().toLowerCase());
      query.status = { $in: statuses };
    }

    if (leaveType) {
      query.leaveType = leaveType.toLowerCase();
    }

    if (employeeEmail) {
      query.employeeEmail = employeeEmail;
    }

    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), 0, 1); // default: Jan 1st of current year

    const end = endDate
      ? new Date(endDate)
      : new Date(new Date().getFullYear(), 11, 31, 23, 59, 59); // default: Dec 31st

    query.startDate = { $lte: end };
    query.endDate = { $gte: start };

    const skip = (page - 1) * limit;
    const total = await LeaveRequest.countDocuments(query);

    const requests = await LeaveRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    return {
      requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }


  calculateWorkingDays(start, end) {
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return (end - start) / (1000 * 60 * 60 * 24);
  }
}

module.exports = LeaveService;