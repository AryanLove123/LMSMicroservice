const LeaveRequest = require('../models/LeaveRequest');
const AppError = require('../../../../shared/utils/AppError');
const { LEAVE_STATUS, RABBIT_EXCHANGES, RABBIT_ROUTING_KEYS } = require('../../../../shared/constants/constant');
class LeaveService {
  constructor(logger, rabbitMQ, empClient) {
    this.logger = logger;
    this.rabbitMQ = rabbitMQ;
    this.empClient = empClient;
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

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const requestedDays = (end - start) / (1000 * 60 * 60 * 24);

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
}

module.exports = LeaveService;