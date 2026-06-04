const { LeaveValidator } = require('../validators/LeaveValidators');
const ApiResponse = require('../../../../shared/utils/ApiResponse');
const { SAGA_STATUS } = require('../../../../shared/constants/constant');
class LeaveController {
  constructor(leaveService) {
    this.leaveService = leaveService;
  }

  requestLeave = async (req, res, next) => {
    try {
      const body = LeaveValidator.validateRequestLeave(req.body);
      const leaveRequest = await this.leaveService.requestLeave(req.user, body);
      return ApiResponse.created(res, 'Leave request submitted successfully', leaveRequest);
    } catch (error) { next(error); }
  }

  reviewLeave = async (req, res, next) => {
    try {
      const body = LeaveValidator.validateReviewLeave(req.body);
      const result = await this.leaveService.reviewLeave(req.user.userId, req.params.id, body);
      if (result.sagaStatus === SAGA_STATUS.STARTED) {
        return res.status(202).json({
          success: true,
          message: result.message,
          data: {
            leaveId: result.leaveId,
            sagaId: result.sagaId,
            status: result.status,
            sagaStatus: result.sagaStatus,
          },
        });
      }
      return ApiResponse.ok(res, result.message || 'Leave request reviewed successfully', {
        leaveId: result.leaveId,
        sagaId: result.sagaId,
        status: result.status,
        sagaStatus: result.sagaStatus,
      });
    } catch (error) { next(error); }

  }

  cancelLeave = async (req, res, next) => {
    try {
      const body = LeaveValidator.validateCancelLeave(req.body);
      await this.leaveService.cancelLeave(req.params.id, req.user, body);
      return ApiResponse.ok(res, 'Leave request cancelled successfully');
    } catch (error) { next(error); }
  }

  getMyLeaves = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, status, leaveType, startDate, endDate } = req.query;
      const leaves = await this.leaveService.getMyLeaves(req.user.userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        leaveType,
        startDate,
        endDate,
      });
      return ApiResponse.ok(res, 'Leave history retrieved successfully', leaves.requests, leaves.pagination);
    } catch (error) { next(error); }
  }

  getTeamLeaves = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, status, leaveType, employeeEmail, startDate, endDate } = req.query;
      const managerId = req.query.managerId || req.user.userId;
      const leaves = await this.leaveService.getTeamLeaves(managerId, {
        page: parseInt(page), limit: parseInt(limit), status, leaveType, employeeEmail, startDate, endDate,
      });
      return ApiResponse.ok(res, 'Team leave requests retrieved successfully', leaves.requests, leaves.pagination);
    } catch (error) { next(error); }
  }
}

module.exports = LeaveController;