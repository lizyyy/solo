const { storage } = require('../models');

class StorageService {
  static getAllApplications() {
    return Object.values(storage.applications);
  }

  static getApplicationById(id) {
    return storage.applications[id];
  }

  static saveApplication(application) {
    storage.applications[application.id] = application;
    return application;
  }

  static deleteApplication(id) {
    delete storage.applications[id];
  }

  static getCallLogsByApplicationId(applicationId) {
    return Object.values(storage.callLogs).filter(log => log.applicationId === applicationId);
  }

  static saveCallLogs(logs) {
    for (const log of logs) {
      storage.callLogs[log.id] = log;
    }
    return logs;
  }

  static getTasksByApplicationId(applicationId) {
    return Object.values(storage.taskDependencies).filter(task => task.applicationId === applicationId);
  }

  static saveTasks(tasks) {
    for (const task of tasks) {
      storage.taskDependencies[task.id] = task;
    }
    return tasks;
  }

  static updateTask(taskId, data) {
    const task = storage.taskDependencies[taskId];
    if (task) {
      task.update(data);
    }
    return task;
  }

  static getAlertsByApplicationId(applicationId) {
    return Object.values(storage.alerts).filter(alert => alert.applicationId === applicationId);
  }

  static saveAlerts(alerts) {
    for (const alert of alerts) {
      storage.alerts[alert.id] = alert;
    }
    return alerts;
  }

  static updateAlert(alertId, data) {
    const alert = storage.alerts[alertId];
    if (alert) {
      alert.update(data);
    }
    return alert;
  }

  static getDocumentsByApplicationId(applicationId) {
    return Object.values(storage.documentLinks).filter(doc => doc.applicationId === applicationId);
  }

  static saveDocuments(docs) {
    for (const doc of docs) {
      storage.documentLinks[doc.id] = doc;
    }
    return docs;
  }

  static getConfirmationsByApplicationId(applicationId) {
    return Object.values(storage.confirmations).filter(conf => conf.applicationId === applicationId);
  }

  static saveConfirmations(confirmations) {
    for (const conf of confirmations) {
      storage.confirmations[conf.id] = conf;
    }
    return confirmations;
  }

  static saveReport(report) {
    storage.reports[report.id] = report;
    return report;
  }

  static getReportsByApplicationId(applicationId) {
    return Object.values(storage.reports).filter(report => report.applicationId === applicationId);
  }

  static getLatestReportByApplicationId(applicationId) {
    const reports = this.getReportsByApplicationId(applicationId);
    if (reports.length === 0) return null;
    return reports.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))[0];
  }
}

module.exports = StorageService;
