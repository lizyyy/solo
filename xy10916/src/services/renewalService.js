const crypto = require('crypto');
const employeeDao = require('../daos/employeeDao');
const certificateDao = require('../daos/certificateDao');
const courseDao = require('../daos/courseDao');
const renewalDao = require('../daos/renewalDao');

class RenewalService {
  generateIdempotencyKey(data) {
    const str = JSON.stringify(data);
    return crypto.createHash('md5').update(str).digest('hex');
  }

  async createEmployeeCertificate(certData, idempotencyKey = null) {
    const key = idempotencyKey || this.generateIdempotencyKey({
      employee_id: certData.employee_id,
      certificate_type_id: certData.certificate_type_id,
      issue_date: certData.issue_date
    });

    const existing = await certificateDao.findByIdempotencyKey(key);
    if (existing) {
      return { isNew: false, data: existing };
    }

    const result = await certificateDao.createEmployeeCertificate(certData, key);
    return { isNew: true, data: result };
  }

  async checkEmployeeQualification(employeeId, certificateTypeId) {
    const employee = await employeeDao.findById(employeeId);
    if (!employee) {
      throw new Error('员工不存在');
    }

    const requiredCourses = await courseDao.findCoursesByCertificateType(certificateTypeId);
    const allScores = await courseDao.findEmployeeCourseScores(employeeId);
    const retakes = await courseDao.findEmployeeRetakeRecords(employeeId);

    const relevantScoreMap = new Map();
    for (const score of allScores) {
      const existing = relevantScoreMap.get(score.course_id);
      if (!existing || new Date(score.exam_date) > new Date(existing.exam_date)) {
        relevantScoreMap.set(score.course_id, score);
      }
    }

    const details = {
      employeeName: employee.name,
      position: employee.position,
      certificateTypeId: certificateTypeId,
      requiredCourseCount: requiredCourses.length,
      courses: [],
      pendingRetakes: 0,
      missingCourses: []
    };

    let isQualified = requiredCourses.length > 0;

    for (const course of requiredCourses) {
      const score = relevantScoreMap.get(course.id);
      
      if (!score) {
        isQualified = false;
        details.missingCourses.push(course.name);
        details.courses.push({
          courseName: course.name,
          score: null,
          examDate: null,
          status: '未考试',
          retakeCount: 0
        });
        continue;
      }

      const courseRetakes = retakes.filter(r => r.course_id === score.course_id);
      const passedRetake = courseRetakes.find(r => r.is_passed);
      const pendingRetake = courseRetakes.find(r => r.status === 'pending');

      const courseStatus = score.is_passed 
        ? '已通过' 
        : passedRetake 
          ? '补考通过' 
          : pendingRetake 
            ? '补考中' 
            : '未通过';

      if (!score.is_passed && !passedRetake) {
        isQualified = false;
      }

      if (pendingRetake) {
        details.pendingRetakes++;
      }

      details.courses.push({
        courseName: score.course_name,
        score: score.score,
        examDate: score.exam_date,
        status: courseStatus,
        retakeCount: courseRetakes.length
      });
    }

    return {
      isQualified,
      details: JSON.stringify(details)
    };
  }

  async generateRenewalChecklist(checklistDate) {
    const employees = await employeeDao.findAll({ status: 'active' });
    const results = [];

    for (const employee of employees) {
      const requirements = await renewalDao.findPositionRequirements(employee.position);
      
      for (const req of requirements) {
        if (!req.is_required) continue;

        const certificates = await certificateDao.findEmployeeCertificates(employee.id);
        const cert = certificates.find(c => 
          c.certificate_type_id === req.certificate_type_id && c.status === 'valid'
        );

        let daysUntilExpiry = null;
        let hasValidCertificate = false;
        
        if (cert) {
          hasValidCertificate = true;
          const expiryDate = new Date(cert.expiry_date);
          const today = new Date(checklistDate);
          daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        }

        const qualification = await this.checkEmployeeQualification(employee.id, req.certificate_type_id);
        
        let status = '待取证';
        if (!hasValidCertificate) {
          status = qualification.isQualified ? '待取证' : '待培训';
        } else if (daysUntilExpiry < 0) {
          status = '已过期';
        } else if (daysUntilExpiry <= 30) {
          status = '即将过期';
        } else if (!qualification.isQualified) {
          status = '待补考';
        } else {
          status = '符合条件';
        }

        const checklist = await renewalDao.createRenewalChecklist({
          employee_id: employee.id,
          certificate_type_id: req.certificate_type_id,
          employee_certificate_id: cert?.id,
          checklist_date: checklistDate,
          status,
          days_until_expiry: daysUntilExpiry,
          is_qualified: qualification.isQualified,
          qualification_details: qualification.details
        });

        results.push(checklist);
      }
    }

    return results;
  }

  async getExpiringCertificates(daysAhead = 30) {
    const certs = await certificateDao.findExpiringCertificates(daysAhead);
    return certs.map(cert => {
      const expiryDate = new Date(cert.expiry_date);
      const today = new Date();
      const daysUntil = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
      
      let alertLevel = 'normal';
      if (daysUntil <= 7) alertLevel = 'critical';
      else if (daysUntil <= 14) alertLevel = 'warning';

      return {
        ...cert,
        days_until_expiry: daysUntil,
        alert_level: alertLevel
      };
    });
  }

  async processRetakeResult(retakeId, score, isPassed, retakeDate) {
    const retake = await courseDao.findRetakeById(retakeId);
    
    if (!retake) {
      throw new Error('补考记录不存在');
    }

    await courseDao.updateRetakeRecord(retakeId, {
      score,
      retake_date: retakeDate,
      is_passed: isPassed,
      status: isPassed ? 'completed' : 'failed'
    });

    if (isPassed) {
      const checklists = await renewalDao.findRenewalChecklists({ status: '待补考' });
      for (const cl of checklists) {
        if (cl.employee_id === retake.employee_id) {
          const qualification = await this.checkEmployeeQualification(
            retake.employee_id, 
            cl.certificate_type_id
          );
          
          if (qualification.isQualified) {
            await renewalDao.updateRenewalChecklist(cl.id, {
              status: '符合条件',
              is_qualified: true,
              qualification_details: qualification.details
            });
          }
        }
      }
    }

    return { success: true, retakeId, isPassed };
  }

  async saveProcessingException(operationType, rawInput, error, processingResult) {
    return await renewalDao.createProcessingException({
      operation_type: operationType,
      raw_input: typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput),
      error_message: error.message || String(error),
      processing_result: typeof processingResult === 'string' ? processingResult : JSON.stringify(processingResult),
      status: 'pending'
    });
  }

  async manualCorrection(targetType, targetId, fieldName, oldValue, newValue, reason, operator) {
    const correction = await renewalDao.createManualCorrection({
      target_type: targetType,
      target_id: targetId,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      reason: reason,
      operator: operator
    });

    return correction;
  }
}

module.exports = new RenewalService();
