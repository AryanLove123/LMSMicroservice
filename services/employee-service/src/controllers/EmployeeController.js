const ApiResponse = require('../../shared/utils/ApiResponse');  

class EmployeeController {
  constructor(employeeService) {
    this.employeeService = employeeService;
  }

  async updateEmployee(req, res, next) {
    try {
      const employeeId = req.params.id;
      const updateData = req.body;
      const requestingUser = req.user;
      const updatedEmployee = await this.employeeService.updateEmployee(employeeId, updateData, requestingUser);
      return ApiResponse.ok(res, 'Employee updated', updatedEmployee);
    } catch (error) {
      next(error);
    }
  }

}

module.exports = EmployeeController;