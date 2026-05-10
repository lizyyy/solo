const { models, EmployeeStatus, DocumentStatus, TaskStatus } = require('../models');
const logger = require('../utils/logger');
const AuditService = require('./audit.service');

class ReportService {
  static getOnboardingDashboard() {
    const employees = models.Employee.findAll();
    const documents = models.EmployeeDocument.findAll();
    const tasks = models.RemediationTask.findAll();
    const contracts = models.Contract.findAll();
    const accounts = models.Account.findAll();
    const salaries = models.SalaryRecord.findAll();
    
    const statusStats = Object.values(EmployeeStatus).reduce((acc, status) => {
      acc[status] = employees.filter(e => e.status === status).length;
      return acc;
    }, {});
    
    const documentStats = {
      total: documents.length,
      required: documents.filter(d => d.isRequired).length,
      approved: documents.filter(d => d.status === DocumentStatus.APPROVED).length,
      pending: documents.filter(d => 
        [DocumentStatus.REQUIRED, DocumentStatus.PENDING, DocumentStatus.SUBMITTED].includes(d.status)
      ).length,
      rejected: documents.filter(d => d.status === DocumentStatus.REJECTED).length,
      waived: documents.filter(d => d.status === DocumentStatus.WAIVED).length
    };
    
    const taskStats = {
      total: tasks.length,
      open: tasks.filter(t => t.status === TaskStatus.OPEN).length,
      inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      expired: tasks.filter(t => t.status === TaskStatus.EXPIRED).length,
      cancelled: tasks.filter(t => t.status === TaskStatus.CANCELLED).length
    };
    
    const completionStats = {
      totalEmployees: employees.length,
      withContracts: contracts.length,
      withAccounts: accounts.length,
      withSalary: salaries.length,
      onboarded: employees.filter(e => e.status === EmployeeStatus.ONBOARDED).length
    };
    
    return {
      generatedAt: new Date().toISOString(),
      statusStats,
      documentStats,
      taskStats,
      completionStats
    };
  }

  static getEmployeeStatusReport(filters = {}) {
    const employees = models.Employee.find(emp => {
      if (filters.status && emp.status !== filters.status) return false;
      if (filters.department && emp.department !== filters.department) return false;
      return true;
    });
    
    return employees.map(emp => {
      const docs = models.EmployeeDocument.find(d => d.employeeId === emp.id);
      const requiredDocs = docs.filter(d => d.isRequired);
      const completedDocs = requiredDocs.filter(d => 
        [DocumentStatus.APPROVED, DocumentStatus.WAIVED].includes(d.status)
      );
      
      const tasks = models.RemediationTask.find(t => t.employeeId === emp.id);
      const openTasks = tasks.filter(t => 
        [TaskStatus.OPEN, TaskStatus.IN_PROGRESS].includes(t.status)
      );
      
      const contract = models.Contract.findOne(c => c.employeeId === emp.id);
      const account = models.Account.findOne(a => a.employeeId === emp.id);
      const salary = models.SalaryRecord.findOne(s => s.employeeId === emp.id);
      
      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        department: emp.department,
        position: emp.position,
        hireDate: emp.hireDate,
        status: emp.status,
        documentProgress: {
          required: requiredDocs.length,
          completed: completedDocs.length,
          percentage: requiredDocs.length > 0 
            ? Math.round((completedDocs.length / requiredDocs.length) * 100) 
            : 100
        },
        openTasks: openTasks.length,
        hasContract: !!contract,
        hasAccount: !!account,
        hasSalary: !!salary,
        updatedAt: emp.updatedAt
      };
    }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  static getDocumentsComplianceReport() {
    const catalogs = models.DocumentCatalog.findAll();
    
    return catalogs.map(catalog => {
      const docs = models.EmployeeDocument.find(d => d.catalogId === catalog.id);
      const employees = models.Employee.findAll();
      
      const requiredForAll = docs.filter(d => d.isRequired);
      const approved = requiredForAll.filter(d => d.status === DocumentStatus.APPROVED);
      const waived = requiredForAll.filter(d => d.status === DocumentStatus.WAIVED);
      const pending = requiredForAll.filter(d => 
        [DocumentStatus.REQUIRED, DocumentStatus.PENDING, DocumentStatus.SUBMITTED].includes(d.status)
      );
      const rejected = requiredForAll.filter(d => d.status === DocumentStatus.REJECTED);
      
      return {
        catalogId: catalog.id,
        code: catalog.code,
        name: catalog.name,
        category: catalog.category,
        isRequired: catalog.isRequired,
        stats: {
          total: employees.length,
          approved: approved.length,
          waived: waived.length,
          pending: pending.length,
          rejected: rejected.length,
          complianceRate: employees.length > 0 
            ? Math.round(((approved.length + waived.length) / employees.length) * 100) 
            : 100
        }
      };
    });
  }

  static getRemediationTasksReport(filters = {}) {
    const tasks = models.RemediationTask.find(task => {
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      return true;
    });
    
    return tasks.map(task => {
      const employee = models.Employee.findById(task.employeeId);
      const document = models.EmployeeDocument.findById(task.documentId);
      
      return {
        id: task.id,
        employee: employee ? { id: employee.id, name: employee.name } : null,
        document: document ? { id: document.id, name: document.name, status: document.status } : null,
        reason: task.reason,
        priority: task.priority,
        status: task.status,
        attempts: task.attempts,
        dueDate: task.dueDate,
        assignee: task.assignee,
        createdAt: task.createdAt,
        completedAt: task.completedAt
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static getHistoryReport(employeeId) {
    const employee = models.Employee.findById(employeeId);
    if (!employee) {
      return { error: '员工不存在' };
    }
    
    const auditLogs = AuditService.getEmployeeHistory(employeeId);
    const statusChanges = AuditService.getStatusChanges(employeeId);
    const documents = models.EmployeeDocument.find(d => d.employeeId === employeeId);
    const tasks = models.RemediationTask.find(t => t.employeeId === employeeId);
    
    return {
      employee: {
        id: employee.id,
        name: employee.name,
        status: employee.status,
        department: employee.department
      },
      statusHistory: statusChanges,
      documentHistory: documents.map(d => ({
        id: d.id,
        name: d.name,
        status: d.status,
        submittedAt: d.submittedAt,
        approvedAt: d.approvedAt,
        rejectedAt: d.rejectedAt
      })),
      taskHistory: tasks.map(t => ({
        id: t.id,
        documentName: t.documentName,
        status: t.status,
        reason: t.reason,
        createdAt: t.createdAt,
        completedAt: t.completedAt
      })),
      fullAuditLog: auditLogs,
      generatedAt: new Date().toISOString()
    };
  }

  static validateOnboardingFlow(employeeId) {
    const employee = models.Employee.findById(employeeId);
    if (!employee) {
      return { valid: false, error: '员工不存在' };
    }
    
    const issues = [];
    const warnings = [];
    
    const docs = models.EmployeeDocument.find(d => d.employeeId === employeeId);
    const requiredDocs = docs.filter(d => d.isRequired);
    const completedDocs = requiredDocs.filter(d => 
      [DocumentStatus.APPROVED, DocumentStatus.WAIVED].includes(d.status)
    );
    
    if (requiredDocs.length > 0 && completedDocs.length !== requiredDocs.length) {
      if (employee.status === EmployeeStatus.DOCUMENTS_COMPLETE || 
          employee.status === EmployeeStatus.CONTRACT_GENERATED ||
          employee.status === EmployeeStatus.ACCOUNT_CREATED ||
          employee.status === EmployeeStatus.SALARY_ESTABLISHED ||
          employee.status === EmployeeStatus.ONBOARDED) {
        warnings.push('员工状态显示资料已完成，但实际上仍有必填资料未完成');
      }
    }
    
    const contract = models.Contract.findOne(c => c.employeeId === employeeId);
    if (contract && employee.status === EmployeeStatus.DOCUMENTS_INCOMPLETE) {
      issues.push('员工资料不完整但已生成合同');
    }
    
    const account = models.Account.findOne(a => a.employeeId === employeeId);
    if (account && !contract) {
      issues.push('员工已有账号但未生成合同');
    }
    
    const salary = models.SalaryRecord.findOne(s => s.employeeId === employeeId);
    if (salary && !account) {
      issues.push('员工已有薪资档案但未创建账号');
    }
    
    const statusHistory = AuditService.getStatusChanges(employeeId);
    const manualCorrections = statusHistory.filter(h => h.reason.includes('人工') || h.reason.includes('MANUAL'));
    if (manualCorrections.length > 0) {
      warnings.push(`该员工曾进行 ${manualCorrections.length} 次人工状态修正`);
    }
    
    return {
      valid: issues.length === 0,
      employeeId,
      employeeName: employee.name,
      currentStatus: employee.status,
      issues,
      warnings,
      documentCompletion: {
        required: requiredDocs.length,
        completed: completedDocs.length
      },
      hasContract: !!contract,
      hasAccount: !!account,
      hasSalary: !!salary,
      manualCorrectionCount: manualCorrections.length
    };
  }
}

module.exports = ReportService;
