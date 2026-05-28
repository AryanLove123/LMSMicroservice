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

  async getEmployeeById(id) {
    const employee = await Employee.findOne({ _id: id, isActive: true });
    if (!employee) throw AppError.notFound('Employee not found');
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

  async getLeaveBalance(userId) {
    const employee = await Employee.findByUserId(userId);
    if (!employee) throw AppError.notFound('Employee not found');
    return employee.leaveBalances;
  }

  async getManagers() {
    const managers = await Employee.find({ role: 'manager', isActive: true });
    if (!managers || managers.length === 0) throw AppError.notFound('Manager not found');
    return managers;
  }

  async updateEmployee(id, data, requestingUser) {
    const employee = await Employee.findById(id);
    if (!employee || !employee.isActive) throw AppError.notFound('Employee not found');

    if (requestingUser.role !== 'admin') {
      throw AppError.forbidden('Only admin can update employee records');
    }
    const { managerId, managerName } = await this.resolveManager(data.managerId);
    employee.managerId = managerId;
    employee.managerName = managerName;
    await employee.save();
    this.logger.info(`[EmployeeService] Employee updated — _id: ${id}`);
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
    const manager = await Employee.findById(managerId);
    if (!manager || manager.role !== 'manager' || !manager.isActive) {
      throw AppError.badRequest('Invalid managerId');
    }
    return { managerId: manager._id, managerName: manager.name };
  }

  async deductLeave(employeeId, leaveType, days) {
    const employee = await Employee.findByUserId(employeeId);
    if (!employee) throw AppError.notFound('Employee not found for deduction');

    employee.deductLeaveBalance(leaveType, days);
    await employee.save();
    this.logger.info(`[EmployeeService] Leave balance deducted — employeeId: ${employeeId}, leaveType: ${leaveType}, days: ${days}`);
    return employee.leaveBalances;
  }

}

module.exports = EmployeeService;