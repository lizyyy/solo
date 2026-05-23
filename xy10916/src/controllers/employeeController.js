const employeeDao = require('../daos/employeeDao');
const certificateDao = require('../daos/certificateDao');
const courseDao = require('../daos/courseDao');
const renewalService = require('../services/renewalService');

class EmployeeController {
  async createEmployee(req, res) {
    try {
      const employee = await employeeDao.create(req.body);
      res.status(201).json({ success: true, data: employee });
    } catch (error) {
      await renewalService.saveProcessingException('createEmployee', req.body, error, { failed: true });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getEmployees(req, res) {
    try {
      const employees = await employeeDao.findAll(req.query);
      res.json({ success: true, data: employees });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getEmployeeById(req, res) {
    try {
      const employee = await employeeDao.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({ success: false, error: '员工不存在' });
      }
      
      const certificates = await certificateDao.findEmployeeCertificates(req.params.id);
      const scores = await courseDao.findEmployeeCourseScores(req.params.id);
      const retakes = await courseDao.findEmployeeRetakeRecords(req.params.id);

      res.json({
        success: true,
        data: {
          employee,
          certificates,
          scores,
          retakes
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateEmployee(req, res) {
    try {
      const changes = await employeeDao.update(req.params.id, req.body);
      if (changes === 0) {
        return res.status(404).json({ success: false, error: '员工不存在' });
      }
      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      await renewalService.saveProcessingException('updateEmployee', req.body, error, { failed: true });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new EmployeeController();
