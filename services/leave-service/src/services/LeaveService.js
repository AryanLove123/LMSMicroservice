const { LeaveRequest } = require('../models/LeaveRequest');
const AppError = require('../../../../shared/utils/AppError');
class LeaveService {
  constructor(logger, rabbitMQ, empClient) {
    this.logger = logger;
    this.rabbitMQ = rabbitMQ;
    this.empClient = empClient;
  }

  requestLeave = async (userId, leaveData) => {
    const { leaveType, startDateStr, endDateStr, reason } = leaveData;
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      throw AppError.badRequest('Start date cannot be in the past');
    }
    if (endDate < startDate) {
      throw AppError.badRequest('End date cannot be before start date');
    }

    const overlap = await LeaveRequest.findOverlapping(userId, startDate, endDate);
    if (overlap) {
      throw AppError.conflict(
        `Overlapping leave (${overlap.status}) from ${overlap.startDate.toDateString()} to ${overlap.endDate.toDateString()}`
      );
    }


  }
}

module.exports = LeaveService;