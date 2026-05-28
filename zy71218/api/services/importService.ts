import {
  InvoiceDAO,
  ConfirmationDAO,
  ContractDAO,
  RepaymentPlanDAO,
  CollectionNoteDAO,
  RiskReportDAO,
  CaseDAO,
  LinkDAO,
} from '../dao/index.js';
import { auditService } from './auditService.js';
import type {
  ImportResult,
  BusinessDataType,
  Invoice,
  Confirmation,
  FactoringContract,
  RepaymentPlan,
  CollectionNote,
  RiskReport,
  User,
} from '../../shared/types.js';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const importService = {
  async importData(
    type: BusinessDataType,
    rows: Record<string, any>[],
    operator: User
  ): Promise<ImportResult> {
    if (!type) {
      throw new Error('导入类型不能为空');
    }
    if (!rows || rows.length === 0) {
      throw new Error('导入数据不能为空');
    }
    if (!operator?.id || !operator?.name) {
      throw new Error('操作员信息不完整');
    }

    const errors: string[] = [];
    const importedIds: string[] = [];
    const validRows: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        importService.validateRow(type, row, i + 1);
        validRows.push(row);
      } catch (e: any) {
        errors.push(`第${i + 1}行: ${e.message}`);
      }
    }

    if (errors.length > 0 && validRows.length === 0) {
      return {
        success: false,
        total: rows.length,
        imported: 0,
        errors,
      };
    }

    let result: ImportResult;

    switch (type) {
      case 'invoice':
        result = await importService.importInvoices(validRows, operator);
        break;
      case 'confirmation':
        result = await importService.importConfirmations(validRows, operator);
        break;
      case 'contract':
        result = await importService.importContracts(validRows, operator);
        break;
      case 'repayment_plan':
        result = await importService.importRepaymentPlans(validRows, operator);
        break;
      case 'collection_note':
        result = await importService.importCollectionNotes(validRows, operator);
        break;
      case 'risk_report':
        result = await importService.importRiskReports(validRows, operator);
        break;
      default:
        throw new Error(`不支持的导入类型: ${type}`);
    }

    result.errors = [...result.errors, ...errors];

    if (result.importedIds && result.importedIds.length > 0) {
      try {
        await importService.autoMatchLinks(result.importedIds);
      } catch (_e) {
        // autoMatchLinks failure should not block import result
      }
    }

    await auditService.logAction(
      operator.id,
      operator.name,
      'import_data',
      type,
      `batch_${Date.now()}`,
      `导入${type}数据，共${rows.length}行，成功${result.imported}行，失败${result.errors.length}行`,
    );

    return result;
  },

  async previewData(
    type: BusinessDataType,
    file: any
  ): Promise<{
    columns: string[];
    rows: Record<string, any>[];
    sampleValidation: {
      valid: boolean;
      errors: string[];
    };
  }> {
    if (!type) {
      throw new Error('导入类型不能为空');
    }

    let columns: string[] = [];
    let rows: Record<string, any>[] = [];

    if (type === 'invoice') {
      columns = ['businessNo', 'invoiceNo', 'sellerName', 'amount', 'taxAmount', 'goodsDescription', 'issueDate', 'dueDate', 'status'];
      rows = file?.rows || [];
    } else if (type === 'confirmation') {
      columns = ['businessNo', 'confirmDate', 'confirmAmount', 'goodsReceived', 'qualityIssue', 'qualityIssueDesc', 'confirmer', 'isWithdrawn', 'withdrawReason', 'withdrawDate', 'status'];
      rows = file?.rows || [];
    } else if (type === 'contract') {
      columns = ['businessNo', 'contractNo', 'factoringRate', 'financingAmount', 'startDate', 'endDate', 'status'];
      rows = file?.rows || [];
    } else if (type === 'repayment_plan') {
      columns = ['businessNo', 'instalmentNo', 'principal', 'interest', 'plannedDate', 'status'];
      rows = file?.rows || [];
    } else if (type === 'collection_note') {
      columns = ['businessNo', 'collectionDate', 'collector', 'collectionMethod', 'contactPerson', 'contactResult', 'nextAction', 'followUpDate'];
      rows = file?.rows || [];
    } else if (type === 'risk_report') {
      columns = ['businessNo', 'riskLevel', 'reportDate', 'analyst', 'keyFindings', 'recommendations'];
      rows = file?.rows || [];
    }

    const errors: string[] = [];
    const sampleCount = Math.min(5, rows.length);
    
    for (let i = 0; i < sampleCount; i++) {
      try {
        importService.validateRow(type, rows[i], i + 1);
      } catch (e: any) {
        errors.push(`第${i + 1}行: ${e.message}`);
      }
    }

    return {
      columns,
      rows: rows.slice(0, 10),
      sampleValidation: {
        valid: errors.length === 0,
        errors,
      },
    };
  },

  async autoMatchLinks(importedIds: string[]): Promise<number> {
    if (!importedIds || importedIds.length === 0) {
      return 0;
    }

    let matchedCount = 0;
    const linksToCreate: any[] = [];

    for (const id of importedIds) {
      const invoice = await InvoiceDAO.getById(id);
      if (invoice && invoice.businessNo) {
        const caseInfo = await CaseDAO.findByBusinessNo(invoice.businessNo);
        if (caseInfo) {
          const existingLinks = await LinkDAO.findBySource(id, 'invoice');
          const alreadyLinked = existingLinks.some(l => l.targetId === invoice.businessNo);
          
          if (!alreadyLinked) {
            linksToCreate.push({
              id: generateId('link'),
              sourceId: id,
              sourceType: 'invoice',
              targetId: invoice.businessNo,
              targetType: 'case',
              linkType: 'belongs_to',
              confidence: 100,
            });
          }
        }
      }

      const confirmation = await ConfirmationDAO.getById(id);
      if (confirmation && confirmation.businessNo) {
        const caseInfo = await CaseDAO.findByBusinessNo(confirmation.businessNo);
        if (caseInfo) {
          const existingLinks = await LinkDAO.findBySource(id, 'confirmation');
          const alreadyLinked = existingLinks.some(l => l.targetId === confirmation.businessNo);
          
          if (!alreadyLinked) {
            linksToCreate.push({
              id: generateId('link'),
              sourceId: id,
              sourceType: 'confirmation',
              targetId: confirmation.businessNo,
              targetType: 'case',
              linkType: 'belongs_to',
              confidence: 100,
            });
          }
        }
      }

      const contract = await ContractDAO.getById(id);
      if (contract && contract.businessNo) {
        const caseInfo = await CaseDAO.findByBusinessNo(contract.businessNo);
        if (caseInfo) {
          const existingLinks = await LinkDAO.findBySource(id, 'contract');
          const alreadyLinked = existingLinks.some(l => l.targetId === contract.businessNo);
          
          if (!alreadyLinked) {
            linksToCreate.push({
              id: generateId('link'),
              sourceId: id,
              sourceType: 'contract',
              targetId: contract.businessNo,
              targetType: 'case',
              linkType: 'belongs_to',
              confidence: 100,
            });
          }
        }
      }

      const repaymentPlan = await RepaymentPlanDAO.getById(id);
      if (repaymentPlan && repaymentPlan.businessNo) {
        const caseInfo = await CaseDAO.findByBusinessNo(repaymentPlan.businessNo);
        if (caseInfo) {
          const existingLinks = await LinkDAO.findBySource(id, 'repayment_plan');
          const alreadyLinked = existingLinks.some(l => l.targetId === repaymentPlan.businessNo);
          
          if (!alreadyLinked) {
            linksToCreate.push({
              id: generateId('link'),
              sourceId: id,
              sourceType: 'repayment_plan',
              targetId: repaymentPlan.businessNo,
              targetType: 'case',
              linkType: 'belongs_to',
              confidence: 100,
            });
          }
        }
      }

      const collectionNote = await CollectionNoteDAO.getById(id);
      if (collectionNote && collectionNote.businessNo) {
        const caseInfo = await CaseDAO.findByBusinessNo(collectionNote.businessNo);
        if (caseInfo) {
          const existingLinks = await LinkDAO.findBySource(id, 'collection_note');
          const alreadyLinked = existingLinks.some(l => l.targetId === collectionNote.businessNo);
          
          if (!alreadyLinked) {
            linksToCreate.push({
              id: generateId('link'),
              sourceId: id,
              sourceType: 'collection_note',
              targetId: collectionNote.businessNo,
              targetType: 'case',
              linkType: 'belongs_to',
              confidence: 100,
            });
          }
        }
      }

      const riskReport = await RiskReportDAO.getById(id);
      if (riskReport && riskReport.businessNo) {
        const caseInfo = await CaseDAO.findByBusinessNo(riskReport.businessNo);
        if (caseInfo) {
          const existingLinks = await LinkDAO.findBySource(id, 'risk_report');
          const alreadyLinked = existingLinks.some(l => l.targetId === riskReport.businessNo);
          
          if (!alreadyLinked) {
            linksToCreate.push({
              id: generateId('link'),
              sourceId: id,
              sourceType: 'risk_report',
              targetId: riskReport.businessNo,
              targetType: 'case',
              linkType: 'belongs_to',
              confidence: 100,
            });
          }
        }
      }
    }

    if (linksToCreate.length > 0) {
      await LinkDAO.batchCreate(linksToCreate);
      matchedCount = linksToCreate.length;
    }

    return matchedCount;
  },

  validateRow(type: BusinessDataType, row: Record<string, any>, rowNum: number): void {
    if (!row) {
      throw new Error('行数据不能为空');
    }

    switch (type) {
      case 'invoice':
        importService.validateInvoiceRow(row, rowNum);
        break;
      case 'confirmation':
        importService.validateConfirmationRow(row, rowNum);
        break;
      case 'contract':
        importService.validateContractRow(row, rowNum);
        break;
      case 'repayment_plan':
        importService.validateRepaymentPlanRow(row, rowNum);
        break;
      case 'collection_note':
        importService.validateCollectionNoteRow(row, rowNum);
        break;
      case 'risk_report':
        importService.validateRiskReportRow(row, rowNum);
        break;
      default:
        throw new Error(`不支持的导入类型: ${type}`);
    }
  },

  validateInvoiceRow(row: Record<string, any>, rowNum: number): void {
    if (!row.businessNo) {
      throw new Error('业务编号不能为空');
    }
    if (!row.invoiceNo) {
      throw new Error('发票号不能为空');
    }
    if (!row.amount || row.amount <= 0) {
      throw new Error('发票金额必须大于0');
    }
    if (!row.issueDate) {
      throw new Error('开票日期不能为空');
    }
    if (!row.dueDate) {
      throw new Error('到期日期不能为空');
    }
  },

  validateConfirmationRow(row: Record<string, any>, rowNum: number): void {
    if (!row.businessNo) {
      throw new Error('业务编号不能为空');
    }
    if (!row.confirmDate) {
      throw new Error('确认日期不能为空');
    }
    if (!row.confirmAmount || row.confirmAmount <= 0) {
      throw new Error('确认金额必须大于0');
    }
    if (!row.confirmer) {
      throw new Error('确认人不能为空');
    }
  },

  validateContractRow(row: Record<string, any>, rowNum: number): void {
    if (!row.businessNo) {
      throw new Error('业务编号不能为空');
    }
    if (!row.contractNo) {
      throw new Error('合同编号不能为空');
    }
    if (!row.factoringRate || row.factoringRate <= 0) {
      throw new Error('保理费率必须大于0');
    }
    if (!row.financingAmount || row.financingAmount <= 0) {
      throw new Error('融资金额必须大于0');
    }
    if (!row.startDate) {
      throw new Error('开始日期不能为空');
    }
    if (!row.endDate) {
      throw new Error('结束日期不能为空');
    }
  },

  validateRepaymentPlanRow(row: Record<string, any>, rowNum: number): void {
    if (!row.businessNo) {
      throw new Error('业务编号不能为空');
    }
    if (!row.instalmentNo || row.instalmentNo < 1) {
      throw new Error('期次必须大于等于1');
    }
    if (!row.principal || row.principal <= 0) {
      throw new Error('本金必须大于0');
    }
    if (row.interest === undefined || row.interest < 0) {
      throw new Error('利息不能为负数');
    }
    if (!row.plannedDate) {
      throw new Error('计划还款日期不能为空');
    }
  },

  async importInvoices(
    rows: Record<string, any>[],
    operator: User
  ): Promise<ImportResult> {
    const importedIds: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        
        const existing = await InvoiceDAO.findByInvoiceNo(row.invoiceNo);
        if (existing) {
          errors.push(`第${i + 1}行: 发票号 ${row.invoiceNo} 已存在`);
          continue;
        }

        const id = generateId('inv');
        const invoiceData: Partial<Invoice> & { id: string } = {
          id,
          businessNo: row.businessNo,
          invoiceNo: row.invoiceNo,
          sellerName: row.sellerName,
          amount: Number(row.amount),
          taxAmount: row.taxAmount ? Number(row.taxAmount) : 0,
          goodsDescription: row.goodsDescription,
          issueDate: row.issueDate,
          dueDate: row.dueDate,
          status: row.status || 'issued',
          version: 1,
        };

        await InvoiceDAO.create(invoiceData);
        importedIds.push(id);
      } catch (e: any) {
        errors.push(`第${i + 1}行: ${e.message}`);
      }
    }

    return {
      success: errors.length === 0,
      total: rows.length,
      imported: importedIds.length,
      importedIds,
      errors,
    };
  },

  async importConfirmations(
    rows: Record<string, any>[],
    operator: User
  ): Promise<ImportResult> {
    const importedIds: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        
        const maxVersion = await ConfirmationDAO.getMaxVersion(row.businessNo);
        const id = generateId('conf');
        const confirmationData: Partial<Confirmation> & { id: string } = {
          id,
          businessNo: row.businessNo,
          confirmDate: row.confirmDate,
          confirmAmount: Number(row.confirmAmount),
          goodsReceived: row.goodsReceived === true || row.goodsReceived === 'true',
          qualityIssue: row.qualityIssue === true || row.qualityIssue === 'true',
          qualityIssueDesc: row.qualityIssueDesc,
          confirmer: row.confirmer,
          isWithdrawn: row.isWithdrawn === true || row.isWithdrawn === 'true',
          withdrawReason: row.withdrawReason,
          withdrawDate: row.withdrawDate,
          status: row.status || 'pending',
          version: maxVersion + 1,
        };

        await ConfirmationDAO.create(confirmationData);
        importedIds.push(id);
      } catch (e: any) {
        errors.push(`第${i + 1}行: ${e.message}`);
      }
    }

    return {
      success: errors.length === 0,
      total: rows.length,
      imported: importedIds.length,
      importedIds,
      errors,
    };
  },

  async importContracts(
    rows: Record<string, any>[],
    operator: User
  ): Promise<ImportResult> {
    const importedIds: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        
        const id = generateId('contract');
        const contractData: Partial<FactoringContract> & { id: string } = {
          id,
          businessNo: row.businessNo,
          contractNo: row.contractNo,
          factoringRate: Number(row.factoringRate),
          financingAmount: Number(row.financingAmount),
          startDate: row.startDate,
          endDate: row.endDate,
          status: row.status || 'active',
          version: 1,
        };

        await ContractDAO.create(contractData);
        importedIds.push(id);
      } catch (e: any) {
        errors.push(`第${i + 1}行: ${e.message}`);
      }
    }

    return {
      success: errors.length === 0,
      total: rows.length,
      imported: importedIds.length,
      importedIds,
      errors,
    };
  },

  async importRepaymentPlans(
    rows: Record<string, any>[],
    operator: User
  ): Promise<ImportResult> {
    const importedIds: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        
        const id = generateId('plan');
        const planData: Partial<RepaymentPlan> & { id: string } = {
          id,
          businessNo: row.businessNo,
          instalmentNo: Number(row.instalmentNo),
          principal: Number(row.principal),
          interest: Number(row.interest || 0),
          plannedDate: row.plannedDate,
          status: row.status || 'pending',
          version: 1,
        };

        await RepaymentPlanDAO.create(planData);
        importedIds.push(id);
      } catch (e: any) {
        errors.push(`第${i + 1}行: ${e.message}`);
      }
    }

    return {
      success: errors.length === 0,
      total: rows.length,
      imported: importedIds.length,
      importedIds,
      errors,
    };
  },

  validateCollectionNoteRow(row: Record<string, any>, rowNum: number): void {
    if (!row.businessNo) {
      throw new Error('业务编号不能为空');
    }
    if (!row.collectionDate) {
      throw new Error('催收日期不能为空');
    }
    if (!row.collector) {
      throw new Error('催收人不能为空');
    }
    if (!row.collectionMethod) {
      throw new Error('催收方式不能为空');
    }
  },

  validateRiskReportRow(row: Record<string, any>, rowNum: number): void {
    if (!row.businessNo) {
      throw new Error('业务编号不能为空');
    }
    if (!row.riskLevel) {
      throw new Error('风险等级不能为空');
    }
    if (!row.reportDate) {
      throw new Error('报告日期不能为空');
    }
    if (!row.analyst) {
      throw new Error('分析师不能为空');
    }
  },

  async importCollectionNotes(
    rows: Record<string, any>[],
    operator: User
  ): Promise<ImportResult> {
    const importedIds: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        
        const id = generateId('note');
        const noteData: Partial<CollectionNote> & { id: string } = {
          id,
          businessNo: row.businessNo,
          collectionDate: row.collectionDate,
          collector: row.collector,
          collectionMethod: row.collectionMethod,
          contactPerson: row.contactPerson,
          contactResult: row.contactResult,
          nextAction: row.nextAction,
          followUpDate: row.followUpDate,
        };

        await CollectionNoteDAO.create(noteData);
        importedIds.push(id);
      } catch (e: any) {
        errors.push(`第${i + 1}行: ${e.message}`);
      }
    }

    return {
      success: errors.length === 0,
      total: rows.length,
      imported: importedIds.length,
      importedIds,
      errors,
    };
  },

  async importRiskReports(
    rows: Record<string, any>[],
    operator: User
  ): Promise<ImportResult> {
    const importedIds: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        
        const id = generateId('risk');
        const reportData: Partial<RiskReport> & { id: string } = {
          id,
          businessNo: row.businessNo,
          riskLevel: row.riskLevel,
          reportDate: row.reportDate,
          analyst: row.analyst,
          keyFindings: row.keyFindings,
          recommendations: row.recommendations,
        };

        await RiskReportDAO.create(reportData);
        importedIds.push(id);
      } catch (e: any) {
        errors.push(`第${i + 1}行: ${e.message}`);
      }
    }

    return {
      success: errors.length === 0,
      total: rows.length,
      imported: importedIds.length,
      importedIds,
      errors,
    };
  },
};

export default importService;
