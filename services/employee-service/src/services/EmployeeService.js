const AppError = require('../../../../shared/utils/AppError');
const { Employee } = require('../models/Employee');

class EmployeeService {
  constructor(logger) {
    this.logger = logger;
  }

  async createEmployee(user) {
    const existingEmployee = await Employee.findByUserId(user.userId);
    if (existingEmployee) throw AppError.conflict('Employee already exists for this user');
    this.logger.info(`[EmployeeService] Creating employee for user: ${user.userId}`);
    const employee = await Employee.create(user);
    this.logger.info(`[EmployeeService] Employee created — _id: ${employee._id}, employeeCode: ${employee.employeeCode}`);
    return employee;
  }

  async getEmployeeById(targetUserId, requestingUser) {
    const employee = await Employee.findByUserId(targetUserId);
    if (!employee) throw AppError.notFound('Employee not found');

    // Internal service call
    if (!requestingUser) {
      return employee;
    }

    if (requestingUser.role === 'manager') {
      if (employee.managerId !== requestingUser.userId) {
        throw AppError.forbidden('You can only access employees reporting to you');
      }
    }
    return employee;
  }

  async getMe(userId) {
    const employee = await Employee.findByUserId(userId);
    if (!employee) throw AppError.notFound('Employee profile not found');
    return employee;
  }

  async getAllEmployees() {
    return Employee.find({ isActive: true });
  }

  async getTeamMembers(managerId) {
    return Employee.findTeamByManagerId(managerId);
  }

  async getLeaveBalance(userId, type = 'all') {
    const employee = await Employee.findByUserId(userId);
    if (!employee) throw AppError.notFound('Employee not found');
    const leaveBalances = employee.leaveBalances;
    if (type.toLowerCase() === 'all') {
      return leaveBalances;
    }
    const balance = leaveBalances.find(
      leave => leave.type.toLowerCase() === type.toLowerCase()
    );

    if (!balance) {
      throw AppError.badRequest(
        `Invalid leave type '${type}'. Allowed values: casual, sick, privilege`
      );
    }
    return balance;
  }

  async getManagers() {
    const managers = await Employee.find({ role: 'manager', isActive: true });
    if (!managers || managers.length === 0) throw AppError.notFound('Manager not found');
    return managers;
  }

  async updateEmployee(userId, data, requestingUser) {
    const employee = await Employee.findByUserId(userId);
    if (!employee || !employee.isActive) throw AppError.notFound('Employee not found');

    if (requestingUser.role !== 'admin') {
      throw AppError.forbidden('Only admin can update employee records');
    }
    const { managerId, managerName } = await this.resolveManager(data.managerId);
    employee.managerId = managerId;
    employee.managerName = managerName;
    await employee.save();
    this.logger.info(`[EmployeeService] Employee updated — _id: ${employee._id}`);
    return employee;
  }

  async deactivateEmployee(id, requestingUser) {
    if (requestingUser.role !== 'admin') {
      throw AppError.forbidden('Only admin can deactivate employees');
    }
    const employee = await Employee.findById(id);
    if (!employee || !employee.isActive) throw AppError.notFound('Employee not found');
    employee.isActive = false;
    await employee.save();
    this.logger.info(`[EmployeeService] Employee deactivated — _id: ${id}`);
  }

  async resolveManager(managerId) {
    const manager = await Employee.findByUserId(managerId);
    if (!manager || manager.role !== 'manager' || !manager.isActive) {
      throw AppError.badRequest('Invalid managerId');
    }
    return { managerId: manager.userId, managerName: manager.name };
  }

  async deductLeave(employeeId, leaveType, days) {
    const employee = await Employee.findByUserId(employeeId);
    if (!employee) throw AppError.notFound('Employee not found for deduction');

    employee.deductLeaveBalance(leaveType, days);
    await employee.save();
    this.logger.info(`[EmployeeService] Leave balance deducted — employeeId: ${employeeId}, leaveType: ${leaveType}, days: ${days}`);
    return employee.leaveBalances;
  }

  async restoreLeave(userId, leaveType, days) {
    const employee = await Employee.findByUserId(userId);
    if (!employee) throw AppError.notFound('Employee not found for balance restore');

    employee.restoreLeaveBalance(leaveType, days);
    await employee.save();
    this.logger.info(`[EmployeeService] Leave balance restored — userId: ${userId}, leaveType: ${leaveType}, days: ${days}`);
    return employee.leaveBalances;
  }

}

module.exports = EmployeeService;