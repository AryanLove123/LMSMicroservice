const ApiResponse = require('../../../../shared/utils/ApiResponse');

class EmployeeController {
  constructor(employeeService) {
    this.employeeService = employeeService;
  }

  getEmployeeById = async (req, res, next) => {
    console.log('[Controller] getEmployeeById called');
    console.log('[Controller] req.isInternalService:', req.isInternalService);
    console.log('[Controller] req.user:', req.user);       // will be undefined on internal calls
    console.log('[Controller] req.params.id:', req.params.id);
    try {
      const employee = await this.employeeService.getEmployeeById(req.params.id);
      return ApiResponse.ok(res, 'Employee retrieved', employee);
    } catch (error) { next(error); }
  }

  getMe = async (req, res, next) => {
    try {
      const employee = await this.employeeService.getMe(req.user.userId);
      return ApiResponse.ok(res, 'Profile retrieved', employee);
    } catch (error) { next(error); }
  }

  getAllEmployees = async (req, res, next) => {
    try {
      const employees = await this.employeeService.getAllEmployees();
      return ApiResponse.ok(res, 'Employees retrieved', employees);
    } catch (error) { next(error); }
  }

  getTeamMembers = async (req, res, next) => {
    try {
      const managerId = req.query.managerId || req.user.userId;
      const team = await this.employeeService.getTeamMembers(managerId);
      return ApiResponse.ok(res, 'Team retrieved', team);
    } catch (error) { next(error); }
  }

  getLeaveBalance = async (req, res, next) => {
    try {
      const balances = await this.employeeService.getLeaveBalance(req.user.userId);
      return ApiResponse.ok(res, 'Leave balances retrieved', balances);
    } catch (error) { next(error); }
  }

  getManagers = async (req, res, next) => {
    try {
      const managers = await this.employeeService.getManagers();
      return ApiResponse.ok(res, 'Managers retrieved', managers);
    } catch (error) { next(error); }
  }

  updateEmployee = async (req, res, next) => {
    try {
      const updatedEmployee = await this.employeeService.updateEmployee(req.params.id, req.body, req.user);
      return ApiResponse.ok(res, 'Employee updated', updatedEmployee);
    } catch (error) { next(error); }
  }

  deactivateEmployee = async (req, res, next) => {
    try {
      await this.employeeService.deactivateEmployee(req.params.id, req.user);
      return ApiResponse.ok(res, 'Employee deactivated');
    } catch (error) { next(error); }
  }
}

module.exports = EmployeeController;