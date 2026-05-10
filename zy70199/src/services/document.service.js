const { models, DocumentStatus, EmployeeStatus } = require('../models');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, DuplicateOperationError } = require('../utils/error-handler');
const AuditService = require('./audit.service');
const EmployeeService = require('./employee.service');

class DocumentService {
  static initializeCatalog() {
    const existing = models.DocumentCatalog.findAll();
    if (existing.length > 0) return existing;
    
    const requiredDocs = [
      { code: 'IDENTITY', name: '身份证复印件', category: 'BASIC', isRequired: true, description: '身份证正反面复印件' },
      { code: 'EDUCATION', name: '学历证书', category: 'BASIC', isRequired: true, description: '最高学历证书复印件' },
      { code: 'PHOTO', name: '一寸照片', category: 'BASIC', isRequired: true, description: '近期一寸免冠照片' },
      { code: 'RESUME', name: '个人简历', category: 'BASIC', isRequired: true, description: '最新个人简历' },
      { code: 'REFERENCE', name: '离职证明', category: 'EMPLOYMENT', isRequired: false, description: '上家单位离职证明（如有）' },
      { code: 'BANK_CARD', name: '银行卡信息', category: 'FINANCIAL', isRequired: true, description: '用于薪资发放的银行卡信息' },
      { code: 'MEDICAL', name: '体检报告', category: 'HEALTH', isRequired: false, description: '入职体检报告' },
      { code: 'SOCIAL_SECURITY', name: '社保转移证明', category: 'BENEFIT', isRequired: false, description: '社保转移相关证明材料' }
    ];
    
    return requiredDocs.map(doc => models.DocumentCatalog.create(doc));
  }

  static getCatalog() {
    return models.DocumentCatalog.findAll();
  }

  static initializeEmployeeDocuments(employeeId, userId = 'system') {
    const catalogs = this.getCatalog();
    const existing = models.EmployeeDocument.find(d => d.employeeId === employeeId);
    
    if (existing.length > 0) {
      logger.info(`Employee ${employeeId} already has documents initialized`);
      return existing;
    }
    
    const documents = catalogs.map(catalog => {
      return models.EmployeeDocument.create({
        employeeId,
        catalogId: catalog.id,
        catalogCode: catalog.code,
        name: catalog.name,
        category: catalog.category,
        isRequired: catalog.isRequired,
        status: catalog.isRequired ? DocumentStatus.REQUIRED : DocumentStatus.PENDING
      });
    });
    
    AuditService.log('DOCUMENTS_INITIALIZED', 'Employee', employeeId, userId, {
      documentCount: documents.length,
      requiredCount: documents.filter(d => d.isRequired).length
    });
    
    logger.info(`Initialized ${documents.length} documents for employee ${employeeId}`);
    return documents;
  }

  static submitDocument(employeeId, documentId, submissionData, userId = 'system') {
    const document = models.EmployeeDocument.findById(documentId);
    if (!document) {
      throw new NotFoundError(`资料不存在: ${documentId}`);
    }
    
    if (document.employeeId !== employeeId) {
      throw new ValidationError('资料不属于该员工');
    }
    
    if (document.status === DocumentStatus.APPROVED) {
      throw new DuplicateOperationError('该资料已审批通过，如需修改请先申请重新提交');
    }
    
    if (!submissionData.fileUrl && !submissionData.content) {
      throw new ValidationError('提交资料必须提供文件或内容');
    }
    
    const previousStatus = document.status;
    
    models.EmployeeDocument.update(documentId, {
      status: DocumentStatus.SUBMITTED,
      fileUrl: submissionData.fileUrl,
      content: submissionData.content,
      submittedAt: new Date().toISOString(),
      submittedBy: userId,
      notes: submissionData.notes
    });
    
    AuditService.log('DOCUMENT_SUBMITTED', 'EmployeeDocument', documentId, userId, {
      employeeId,
      documentName: document.name,
      previousStatus,
      newStatus: DocumentStatus.SUBMITTED
    });
    
    logger.info(`Document ${document.name} submitted for employee ${employeeId}`);
    
    this._checkEmployeeDocumentCompletion(employeeId, userId);
    
    return models.EmployeeDocument.findById(documentId);
  }

  static approveDocument(employeeId, documentId, userId = 'admin') {
    const document = models.EmployeeDocument.findById(documentId);
    if (!document) {
      throw new NotFoundError(`资料不存在: ${documentId}`);
    }
    
    if (document.status === DocumentStatus.APPROVED) {
      throw new DuplicateOperationError('该资料已审批通过');
    }
    
    if (document.status !== DocumentStatus.SUBMITTED) {
      throw new ValidationError('只能审批已提交的资料');
    }
    
    models.EmployeeDocument.update(documentId, {
      status: DocumentStatus.APPROVED,
      approvedAt: new Date().toISOString(),
      approvedBy: userId
    });
    
    AuditService.log('DOCUMENT_APPROVED', 'EmployeeDocument', documentId, userId, {
      employeeId,
      documentName: document.name
    });
    
    logger.info(`Document ${document.name} approved for employee ${employeeId}`);
    
    this._checkEmployeeDocumentCompletion(employeeId, userId);
    
    return models.EmployeeDocument.findById(documentId);
  }

  static rejectDocument(employeeId, documentId, reason, userId = 'admin') {
    const document = models.EmployeeDocument.findById(documentId);
    if (!document) {
      throw new NotFoundError(`资料不存在: ${documentId}`);
    }
    
    if (!reason || reason.trim().length < 5) {
      throw new ValidationError('拒绝原因至少需要5个字符');
    }
    
    models.EmployeeDocument.update(documentId, {
      status: DocumentStatus.REJECTED,
      rejectionReason: reason,
      rejectedAt: new Date().toISOString(),
      rejectedBy: userId
    });
    
    AuditService.log('DOCUMENT_REJECTED', 'EmployeeDocument', documentId, userId, {
      employeeId,
      documentName: document.name,
      reason
    });
    
    logger.warn(`Document ${document.name} rejected for employee ${employeeId}: ${reason}`);
    
    this._checkEmployeeDocumentCompletion(employeeId, userId);
    
    return models.EmployeeDocument.findById(documentId);
  }

  static waiveDocument(employeeId, documentId, reason, userId = 'admin') {
    const document = models.EmployeeDocument.findById(documentId);
    if (!document) {
      throw new NotFoundError(`资料不存在: ${documentId}`);
    }
    
    if (!reason || reason.trim().length < 5) {
      throw new ValidationError('豁免原因至少需要5个字符');
    }
    
    models.EmployeeDocument.update(documentId, {
      status: DocumentStatus.WAIVED,
      waiverReason: reason,
      waivedAt: new Date().toISOString(),
      waivedBy: userId
    });
    
    AuditService.log('DOCUMENT_WAIVED', 'EmployeeDocument', documentId, userId, {
      employeeId,
      documentName: document.name,
      reason
    });
    
    logger.warn(`Document ${document.name} waived for employee ${employeeId}: ${reason}`);
    
    this._checkEmployeeDocumentCompletion(employeeId, userId);
    
    return models.EmployeeDocument.findById(documentId);
  }

  static getEmployeeDocuments(employeeId) {
    const documents = models.EmployeeDocument.find(d => d.employeeId === employeeId);
    const requiredDocs = documents.filter(d => d.isRequired);
    const completedRequired = requiredDocs.filter(d => 
      [DocumentStatus.APPROVED, DocumentStatus.WAIVED].includes(d.status)
    );
    
    return {
      documents,
      summary: {
        total: documents.length,
        required: requiredDocs.length,
        completed: completedRequired.length,
        pending: documents.filter(d => 
          [DocumentStatus.REQUIRED, DocumentStatus.PENDING, DocumentStatus.SUBMITTED].includes(d.status)
        ).length,
        rejected: documents.filter(d => d.status === DocumentStatus.REJECTED).length,
        isComplete: completedRequired.length === requiredDocs.length
      }
    };
  }

  static getMissingRequiredDocuments(employeeId) {
    const documents = models.EmployeeDocument.find(d => d.employeeId === employeeId);
    return documents.filter(d => 
      d.isRequired && 
      ![DocumentStatus.APPROVED, DocumentStatus.WAIVED].includes(d.status)
    );
  }

  static _checkEmployeeDocumentCompletion(employeeId, userId) {
    const missing = this.getMissingRequiredDocuments(employeeId);
    const employee = models.Employee.findById(employeeId);
    
    if (!employee) return;
    
    const currentStatus = employee.status;
    
    if (missing.length === 0) {
      if (currentStatus === EmployeeStatus.PENDING_REVIEW || 
          currentStatus === EmployeeStatus.DOCUMENTS_INCOMPLETE) {
        EmployeeService.updateStatus(employeeId, EmployeeStatus.DOCUMENTS_COMPLETE, '所有必填资料已完成', userId);
        logger.info(`Employee ${employeeId} documents are now complete`);
      }
    } else {
      if (currentStatus === EmployeeStatus.DOCUMENTS_COMPLETE) {
        EmployeeService.updateStatus(employeeId, EmployeeStatus.DOCUMENTS_INCOMPLETE, `仍缺少 ${missing.length} 项必填资料`, userId);
        logger.info(`Employee ${employeeId} documents incomplete, missing: ${missing.map(d => d.name).join(', ')}`);
      }
    }
  }
}

module.exports = DocumentService;
