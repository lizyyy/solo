const StatusHistory = require('../models/StatusHistory');
const ReplacementApplication = require('../models/ReplacementApplication');

class StatusHistoryService {
  recordStatusChange(applicationId, module, oldStatus, newStatus, operator, reason, details) {
    return StatusHistory.create({
      application_id: applicationId,
      module,
      old_status: oldStatus,
      new_status: newStatus,
      operator,
      reason,
      details: details ? JSON.stringify(details) : null
    });
  }

  getHistory(applicationId) {
    const history = StatusHistory.findByApplicationId(applicationId);
    return history.map(h => ({
      ...h,
      details: h.details ? JSON.parse(h.details) : null
    }));
  }

  updateApplicationStatus(applicationId, newStatus, module, operator, reason, details) {
    const application = ReplacementApplication.findById(applicationId);
    if (!application) {
      throw new Error('申请单不存在');
    }

    const oldStatus = application.status;
    
    if (oldStatus === newStatus) {
      return { application, statusChanged: false };
    }

    ReplacementApplication.update(applicationId, { status: newStatus });

    this.recordStatusChange(
      applicationId,
      module,
      oldStatus,
      newStatus,
      operator,
      reason,
      details
    );

    const updatedApplication = ReplacementApplication.findById(applicationId);
    return { application: updatedApplication, statusChanged: true };
  }
}

module.exports = new StatusHistoryService();
