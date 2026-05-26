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

  async updateEmployee(id, data, requestingUser) {
    const employee = await Employee.findById(id);
    if (!employee || !employee.isActive) throw AppError.notFound('Employee not found');
    
    if (requestingUser.role !== 'admin') {
      throw AppError.forbidden('Only admin can assign or change a manager');
    }
    const {managerId, managerName} = resolveManager(data.managerId);
    employee.managerId = managerId;
    employee.managerName = managerName;
    await employee.save();
    this.logger.info(`[EmployeeService] Employee updated with EmployeeId: ${id}`);
    return employee;
  }
}

module.exports = EmployeeService;