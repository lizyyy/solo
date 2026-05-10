const { v4: uuidv4 } = require('uuid');

const data = {
  employees: [],
  documentCatalogs: [],
  employeeDocuments: [],
  remediationTasks: [],
  contracts: [],
  accounts: [],
  salaryRecords: [],
  auditLogs: [],
  backgroundJobs: []
};

const EmployeeStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  DOCUMENTS_INCOMPLETE: 'DOCUMENTS_INCOMPLETE',
  DOCUMENTS_COMPLETE: 'DOCUMENTS_COMPLETE',
  CONTRACT_GENERATED: 'CONTRACT_GENERATED',
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  SALARY_ESTABLISHED: 'SALARY_ESTABLISHED',
  ONBOARDED: 'ONBOARDED',
  MANUALLY_CORRECTED: 'MANUALLY_CORRECTED'
};

const DocumentStatus = {
  REQUIRED: 'REQUIRED',
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WAIVED: 'WAIVED'
};

const TaskStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED'
};

const JobStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
  CANCELLED: 'CANCELLED'
};

function createModel(createFn, updateFn, findFn) {
  return {
    create: createFn,
    update: updateFn,
    find: findFn,
    findById: (id) => findFn(item => item.id === id)[0],
    findOne: (predicate) => findFn(predicate)[0],
    findAll: () => findFn(() => true)
  };
}

const models = {
  Employee: createModel(
    (data_) => {
      const employee = {
        id: uuidv4(),
        ...data_,
        status: data_.status || EmployeeStatus.PENDING_REVIEW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.employees.push(employee);
      return employee;
    },
    (id, updates) => {
      const index = data.employees.findIndex(e => e.id === id);
      if (index === -1) return null;
      data.employees[index] = {
        ...data.employees[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return data.employees[index];
    },
    (predicate) => data.employees.filter(predicate)
  ),

  DocumentCatalog: createModel(
    (data_) => {
      const catalog = {
        id: uuidv4(),
        ...data_,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.documentCatalogs.push(catalog);
      return catalog;
    },
    (id, updates) => {
      const index = data.documentCatalogs.findIndex(d => d.id === id);
      if (index === -1) return null;
      data.documentCatalogs[index] = {
        ...data.documentCatalogs[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return data.documentCatalogs[index];
    },
    (predicate) => data.documentCatalogs.filter(predicate)
  ),

  EmployeeDocument: createModel(
    (data_) => {
      const doc = {
        id: uuidv4(),
        ...data_,
        status: data_.status || DocumentStatus.PENDING,
        submittedAt: data_.submittedAt || null,
        approvedAt: data_.approvedAt || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.employeeDocuments.push(doc);
      return doc;
    },
    (id, updates) => {
      const index = data.employeeDocuments.findIndex(d => d.id === id);
      if (index === -1) return null;
      data.employeeDocuments[index] = {
        ...data.employeeDocuments[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return data.employeeDocuments[index];
    },
    (predicate) => data.employeeDocuments.filter(predicate)
  ),

  RemediationTask: createModel(
    (data_) => {
      const task = {
        id: uuidv4(),
        ...data_,
        status: data_.status || TaskStatus.OPEN,
        attempts: data_.attempts || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.remediationTasks.push(task);
      return task;
    },
    (id, updates) => {
      const index = data.remediationTasks.findIndex(t => t.id === id);
      if (index === -1) return null;
      data.remediationTasks[index] = {
        ...data.remediationTasks[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return data.remediationTasks[index];
    },
    (predicate) => data.remediationTasks.filter(predicate)
  ),

  Contract: createModel(
    (data_) => {
      const contract = {
        id: uuidv4(),
        ...data_,
        version: data_.version || 1,
        generatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.contracts.push(contract);
      return contract;
    },
    (id, updates) => {
      const index = data.contracts.findIndex(c => c.id === id);
      if (index === -1) return null;
      data.contracts[index] = {
        ...data.contracts[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return data.contracts[index];
    },
    (predicate) => data.contracts.filter(predicate)
  ),

  Account: createModel(
    (data_) => {
      const account = {
        id: uuidv4(),
        ...data_,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.accounts.push(account);
      return account;
    },
    (id, updates) => {
      const index = data.accounts.findIndex(a => a.id === id);
      if (index === -1) return null;
      data.accounts[index] = {
        ...data.accounts[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return data.accounts[index];
    },
    (predicate) => data.accounts.filter(predicate)
  ),

  SalaryRecord: createModel(
    (data_) => {
      const salary = {
        id: uuidv4(),
        ...data_,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.salaryRecords.push(salary);
      return salary;
    },
    (id, updates) => {
      const index = data.salaryRecords.findIndex(s => s.id === id);
      if (index === -1) return null;
      data.salaryRecords[index] = {
        ...data.salaryRecords[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return data.salaryRecords[index];
    },
    (predicate) => data.salaryRecords.filter(predicate)
  ),

  AuditLog: createModel(
    (data_) => {
      const log = {
        id: uuidv4(),
        ...data_,
        timestamp: new Date().toISOString()
      };
      data.auditLogs.push(log);
      return log;
    },
    () => null,
    (predicate) => data.auditLogs.filter(predicate)
  ),

  BackgroundJob: createModel(
    (data_) => {
      const job = {
        id: uuidv4(),
        ...data_,
        status: data_.status || JobStatus.PENDING,
        attempts: data_.attempts || 0,
        maxAttempts: data_.maxAttempts || 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        error: null
      };
      data.backgroundJobs.push(job);
      return job;
    },
    (id, updates) => {
      const index = data.backgroundJobs.findIndex(j => j.id === id);
      if (index === -1) return null;
      data.backgroundJobs[index] = {
        ...data.backgroundJobs[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return data.backgroundJobs[index];
    },
    (predicate) => data.backgroundJobs.filter(predicate)
  )
};

module.exports = {
  models,
  data,
  EmployeeStatus,
  DocumentStatus,
  TaskStatus,
  JobStatus
};
