const { log } = require('winston');
const {Employee} = require('../models/Employee');
class EmployeeService {
  constructor(logger) {
    this.logger = logger;
  }

  async createEmployee(user) {
    const existingEmployee = await Employee.findByUserId(user.userId);
    if (existingEmployee) throw AppError.conflict('Employee already exists for this user');
    this.logger.info(`[EmployeeService] Creating employee for user: ${user.userId}`);
    const employee =  await Employee.create(user);
    this.logger.info(`[EmployeeService] Employee created with EmployeeId: ${employee.id} and Employee Code: ${employee.employeeCode}`);
    return employee;
  }
}

module.exports = EmployeeService;