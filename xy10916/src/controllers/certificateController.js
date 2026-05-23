const certificateDao = require('../daos/certificateDao');
const courseDao = require('../daos/courseDao');
const renewalService = require('../services/renewalService');

class CertificateController {
  async createCertificateType(req, res) {
    try {
      const certType = await certificateDao.createCertificateType(req.body);
      res.status(201).json({ success: true, data: certType });
    } catch (error) {
      await renewalService.saveProcessingException('createCertificateType', req.body, error, { failed: true });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getCertificateTypes(req, res) {
    try {
      const types = await certificateDao.findAllCertificateTypes();
      res.json({ success: true, data: types });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createEmployeeCertificate(req, res) {
    try {
      const { idempotency_key, ...certData } = req.body;
      const result = await renewalService.createEmployeeCertificate(certData, idempotency_key);
      
      const statusCode = result.isNew ? 201 : 200;
      res.status(statusCode).json({
        success: true,
        isNew: result.isNew,
        data: result.data,
        message: result.isNew ? '证书创建成功' : '证书已存在（幂等返回）'
      });
    } catch (error) {
      await renewalService.saveProcessingException('createEmployeeCertificate', req.body, error, { failed: true });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async createCourse(req, res) {
    try {
      const course = await courseDao.createCourse(req.body);
      res.status(201).json({ success: true, data: course });
    } catch (error) {
      await renewalService.saveProcessingException('createCourse', req.body, error, { failed: true });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getCourses(req, res) {
    try {
      const courses = await courseDao.findAllCourses();
      res.json({ success: true, data: courses });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createCourseScore(req, res) {
    try {
      const score = await courseDao.createCourseScore(req.body);
      res.status(201).json({ success: true, data: score });
    } catch (error) {
      await renewalService.saveProcessingException('createCourseScore', req.body, error, { failed: true });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async createRetakeRecord(req, res) {
    try {
      const retake = await courseDao.createRetakeRecord(req.body);
      res.status(201).json({ success: true, data: retake });
    } catch (error) {
      await renewalService.saveProcessingException('createRetakeRecord', req.body, error, { failed: true });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async processRetakeResult(req, res) {
    try {
      const { retake_id, score, is_passed, retake_date } = req.body;
      const result = await renewalService.processRetakeResult(retake_id, score, is_passed, retake_date);
      res.json({ success: true, data: result, message: is_passed ? '补考通过，状态已更新' : '补考未通过' });
    } catch (error) {
      await renewalService.saveProcessingException('processRetakeResult', req.body, error, { failed: true });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getExpiringCertificates(req, res) {
    try {
      const daysAhead = parseInt(req.query.days_ahead) || 30;
      const certs = await renewalService.getExpiringCertificates(daysAhead);
      res.json({
        success: true,
        days_ahead: daysAhead,
        total: certs.length,
        data: certs
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new CertificateController();
