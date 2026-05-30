import type {
  ImportRequest,
  ImportResponse,
  ImportPreviewResponse,
  Customer,
  GuaranteeContract,
  CreditLine,
  CounterGuarantee,
  FileSourceType,
  DataImportWarning,
  FailedItem,
  ImportBatch,
  BatchTask
} from '../../../shared/types.js';
import { customerRepository } from '../repositories/CustomerRepository.js';
import { guaranteeRepository } from '../repositories/GuaranteeRepository.js';
import { creditRepository } from '../repositories/CreditRepository.js';
import { versionRepository } from '../repositories/VersionRepository.js';
import { riskRepository } from '../repositories/RiskRepository.js';
import { AnomalyDetector, AnomalyDetectionResult } from '../utils/anomalyDetection.js';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

const CALCULATION_VERSION = '1.0.0';

interface ParsedData {
  customers: any[];
  guarantees: any[];
  credits: any[];
  counterGuarantees: any[];
  warnings: any[];
  failedItems: FailedItem[];
}

export class DataImportService {
  async previewImport(request: ImportRequest): Promise<ImportPreviewResponse> {
    const batchId = uuidv4();
    const { parsedData, totalRows, validRows, errorRows } = this.parseFiles(
      request.files,
      batchId,
      'preview-version'
    );

    const existingCustomers = customerRepository.list();
    const existingGuarantees = guaranteeRepository.findAllContracts();
    const existingCredits = creditRepository.findAllCreditLines();
    const existingCG = guaranteeRepository.findAllCounterGuarantees();

    const allCustomers = [...existingCustomers, ...parsedData.customers.map(c => ({ ...c, id: uuidv4() }))];
    const allGuarantees = [...existingGuarantees, ...parsedData.guarantees.map(g => ({ ...g, id: uuidv4() }))];
    const allCredits = [...existingCredits, ...parsedData.credits.map(c => ({ ...c, id: uuidv4() }))];
    const allCG = [...existingCG, ...parsedData.counterGuarantees.map(cg => ({ ...cg, id: uuidv4() }))];

    const detector = new AnomalyDetector(batchId);
    detector.setData(allCustomers, allGuarantees, allCredits, allCG);
    const detectionResult = detector.detect();

    const allWarnings = [
      ...parsedData.warnings.map(w => ({ id: uuidv4(), batchId, ...w })),
      ...detectionResult.anomalies
    ];

    return {
      batchId,
      totalRows,
      validRows,
      errorRows,
      warnings: allWarnings,
      sampleData: this.getSampleData(parsedData)
    };
  }

  async executeImport(request: ImportRequest, operator: string): Promise<ImportResponse> {
    const batchId = uuidv4();
    const taskId = uuidv4();

    let activeVersion = versionRepository.getActiveSnapshot();
    let versionId = activeVersion?.id || uuidv4();
    const dataVersion = request.createNewVersion 
      ? `v${Date.now()}`
      : activeVersion?.dataVersion || 'v1.0.0';

    if (request.createNewVersion || !activeVersion) {
      const newSnapshot = versionRepository.createSnapshot({
        name: request.versionName || `数据导入 ${new Date().toLocaleString()}`,
        description: request.versionDescription || '',
        createdBy: operator,
        dataVersion,
        calculationVersion: CALCULATION_VERSION,
        dataFiles: request.files.map(f => f.name),
        isActive: true,
        canRollback: true
      });
      versionId = newSnapshot.id;

      if (activeVersion) {
        versionRepository.createOperationLog({
          operationType: 'import_create_version',
          operator,
          description: `创建新版本: ${newSnapshot.name}`,
          affectedObjects: [newSnapshot.id],
          previousSnapshotId: activeVersion.id,
          canUndo: true
        });
      }
    }

    const batch = creditRepository.createImportBatch({
      name: request.files.map(f => f.name).join(', '),
      uploader: operator,
      status: 'processing',
      totalRows: 0,
      validRows: 0,
      errorRows: 0,
      version: versionId
    });

    setImmediate(async () => {
      try {
        await this.processImport(request, batch.id, versionId, operator);
      } catch (error) {
        console.error('Import processing error:', error);
        creditRepository.updateImportBatchStatus(batch.id, 'error');
      }
    });

    return {
      batchId: batch.id,
      taskId
    };
  }

  private async processImport(
    request: ImportRequest,
    batchId: string,
    versionId: string,
    operator: string
  ): Promise<void> {
    const { parsedData, totalRows, validRows, errorRows } = this.parseFiles(
      request.files,
      batchId,
      versionId
    );

    const existingCustomers = customerRepository.list(versionId);
    const existingGuarantees = guaranteeRepository.findAllContracts(versionId);
    const existingCredits = creditRepository.findAllCreditLines(versionId);
    const existingCG = guaranteeRepository.findAllCounterGuarantees(versionId);

    const allCustomers = [...existingCustomers, ...parsedData.customers.map(c => ({ ...c, id: uuidv4() }))];
    const allGuarantees = [...existingGuarantees, ...parsedData.guarantees.map(g => ({ ...g, id: uuidv4() }))];
    const allCredits = [...existingCredits, ...parsedData.credits.map(c => ({ ...c, id: uuidv4() }))];
    const allCG = [...existingCG, ...parsedData.counterGuarantees.map(cg => ({ ...cg, id: uuidv4() }))];

    const detector = new AnomalyDetector(batchId);
    detector.setData(allCustomers, allGuarantees, allCredits, allCG);
    const detectionResult = detector.detect();

    const allWarnings = [
      ...parsedData.warnings,
      ...detectionResult.anomalies.map(a => ({
        ...a,
        batchId
      }))
    ];

    if (parsedData.customers.length > 0) {
      customerRepository.bulkCreate(parsedData.customers);
    }
    if (parsedData.guarantees.length > 0) {
      guaranteeRepository.bulkCreateContracts(parsedData.guarantees);
    }
    if (parsedData.credits.length > 0) {
      creditRepository.bulkCreateCreditLines(parsedData.credits);
    }
    if (parsedData.counterGuarantees.length > 0) {
      guaranteeRepository.bulkCreateCounterGuarantees(parsedData.counterGuarantees);
    }

    if (allWarnings.length > 0) {
      creditRepository.bulkCreateImportWarnings(allWarnings);
    }

    const finalStatus = errorRows > 0 && validRows === 0 ? 'error' : 
                       errorRows > 0 ? 'partial' : 'completed';
    creditRepository.updateImportBatchStatus(batchId, finalStatus, validRows, errorRows);

    versionRepository.createOperationLog({
      operationType: 'data_import',
      operator,
      description: `导入数据 ${request.files.length} 份文件，${validRows} 条有效，${errorRows} 条错误`,
      affectedObjects: [
        ...parsedData.customers.map(c => c.name || (c as Customer).id),
        ...parsedData.guarantees.map(g => g.contractNumber || (g as GuaranteeContract).id)
      ].slice(0, 50),
      previousSnapshotId: versionId,
      canUndo: true
    });
  }

  private parseFiles(
    files: { name: string; sourceType: FileSourceType; content: string }[],
    batchId: string,
    versionId: string
  ): {
    parsedData: ParsedData;
    totalRows: number;
    validRows: number;
    errorRows: number;
  } {
    const result: ParsedData = {
      customers: [],
      guarantees: [],
      credits: [],
      counterGuarantees: [],
      warnings: [],
      failedItems: []
    };

    let totalRows = 0;
    let validRows = 0;
    let errorRows = 0;

    for (const file of files) {
      try {
        const parsed = this.parseFile(file, batchId, versionId);
        result.customers.push(...parsed.customers);
        result.guarantees.push(...parsed.guarantees);
        result.credits.push(...parsed.credits);
        result.counterGuarantees.push(...parsed.counterGuarantees);
        result.warnings.push(...parsed.warnings);
        result.failedItems.push(...parsed.failedItems);

        totalRows += parsed.customers.length + parsed.guarantees.length + 
                     parsed.credits.length + parsed.counterGuarantees.length + parsed.failedItems.length;
        validRows += parsed.customers.length + parsed.guarantees.length + 
                     parsed.credits.length + parsed.counterGuarantees.length;
        errorRows += parsed.failedItems.length;
      } catch (error) {
        result.failedItems.push({
          index: 0,
          objectId: '',
          objectName: file.name,
          sourceFile: file.name,
          rowNumber: 0,
          errorMessage: `文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
          errorCode: 'PARSE_ERROR',
          rawData: { fileName: file.name }
        });
        errorRows++;
        totalRows++;
      }
    }

    return { parsedData: result, totalRows, validRows, errorRows };
  }

  private parseFile(
    file: { name: string; sourceType: FileSourceType; content: string },
    batchId: string,
    versionId: string
  ): ParsedData {
    const result: ParsedData = {
      customers: [],
      guarantees: [],
      credits: [],
      counterGuarantees: [],
      warnings: [],
      failedItems: []
    };

    let workbook: XLSX.WorkBook;
    try {
      const contentBuffer = Buffer.from(file.content, 'base64');
      workbook = XLSX.read(contentBuffer, { type: 'buffer' });
    } catch {
      try {
        const jsonContent = JSON.parse(file.content);
        return this.parseJsonData(jsonContent, file, batchId, versionId);
      } catch (jsonError) {
        throw new Error('无法解析文件，支持 Excel (.xlsx, .xls) 和 JSON 格式');
      }
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        switch (file.sourceType) {
          case 'customer':
            result.customers.push(this.parseCustomerRow(row, file.name, batchId, versionId, rowNumber));
            break;
          case 'guarantee':
            result.guarantees.push(this.parseGuaranteeRow(row, file.name, batchId, versionId, rowNumber));
            break;
          case 'credit':
            result.credits.push(this.parseCreditRow(row, file.name, batchId, versionId, rowNumber));
            break;
          case 'counterGuarantee':
            result.counterGuarantees.push(this.parseCounterGuaranteeRow(row, file.name, batchId, versionId, rowNumber));
            break;
          default:
            result.warnings.push({
              sourceFile: file.name,
              rowNumber,
              objectId: '',
              objectName: '',
              warningType: 'unknown_source_type',
              severity: 'info',
              message: `未知的数据源类型: ${file.sourceType}`,
              suggestion: '请检查文件类型配置',
              rawData: row
            });
        }
      } catch (error) {
        result.failedItems.push({
          index: i,
          objectId: '',
          objectName: row['name'] || row['客户名称'] || `第${rowNumber}行`,
          sourceFile: file.name,
          rowNumber,
          errorMessage: error instanceof Error ? error.message : '解析失败',
          errorCode: 'ROW_PARSE_ERROR',
          rawData: row
        });
      }
    }

    return result;
  }

  private parseJsonData(
    data: any,
    file: { name: string; sourceType: FileSourceType },
    batchId: string,
    versionId: string
  ): ParsedData {
    const result: ParsedData = {
      customers: [],
      guarantees: [],
      credits: [],
      counterGuarantees: [],
      warnings: [],
      failedItems: []
    };

    const rows = Array.isArray(data) ? data : [data];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        switch (file.sourceType) {
          case 'customer':
            result.customers.push(this.parseCustomerRow(row, file.name, batchId, versionId, i + 1));
            break;
          case 'guarantee':
            result.guarantees.push(this.parseGuaranteeRow(row, file.name, batchId, versionId, i + 1));
            break;
          case 'credit':
            result.credits.push(this.parseCreditRow(row, file.name, batchId, versionId, i + 1));
            break;
          case 'counterGuarantee':
            result.counterGuarantees.push(this.parseCounterGuaranteeRow(row, file.name, batchId, versionId, i + 1));
            break;
        }
      } catch (error) {
        result.failedItems.push({
          index: i,
          objectId: '',
          objectName: row.name || row['客户名称'] || `第${i + 1}行`,
          sourceFile: file.name,
          rowNumber: i + 1,
          errorMessage: error instanceof Error ? error.message : '解析失败',
          errorCode: 'ROW_PARSE_ERROR',
          rawData: row
        });
      }
    }

    return result;
  }

  private parseCustomerRow(
    row: Record<string, any>,
    sourceFile: string,
    batchId: string,
    versionId: string,
    rowNumber: number
  ): Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> {
    const name = this.getFieldValue(row, ['name', '客户名称', '企业名称']);
    if (!name) {
      throw new Error('缺少客户名称');
    }

    return {
      name: String(name).trim(),
      customerType: this.getFieldValue(row, ['customerType', '客户类型', '类型']) || 'enterprise',
      creditRating: this.getFieldValue(row, ['creditRating', '信用评级', '评级']) || '',
      industry: this.getFieldValue(row, ['industry', '行业', '所属行业']) || '',
      attributes: row,
      version: versionId,
      sourceFile,
      sourceBatch: batchId
    };
  }

  private parseGuaranteeRow(
    row: Record<string, any>,
    sourceFile: string,
    batchId: string,
    versionId: string,
    rowNumber: number
  ): Omit<GuaranteeContract, 'id' | 'createdAt' | 'updatedAt'> {
    const guarantorId = this.getFieldValue(row, ['guarantorId', '担保人ID', '担保人']);
    const guaranteedId = this.getFieldValue(row, ['guaranteedId', '被担保人ID', '被担保人']);
    const amount = this.parseNumber(this.getFieldValue(row, ['amount', '担保金额', '金额']));

    if (!guarantorId || !guaranteedId) {
      throw new Error('缺少担保人或被担保人信息');
    }
    if (amount <= 0) {
      throw new Error('担保金额必须大于0');
    }

    return {
      guarantorId: String(guarantorId),
      guaranteedId: String(guaranteedId),
      amount,
      currency: this.getFieldValue(row, ['currency', '币种', '货币']) || 'CNY',
      startDate: this.parseDate(this.getFieldValue(row, ['startDate', '开始日期', '担保起始日'])),
      endDate: this.parseDate(this.getFieldValue(row, ['endDate', '结束日期', '担保到期日'])),
      contractNumber: this.getFieldValue(row, ['contractNumber', '合同编号', '担保合同号']) || '',
      isCounterGuarantee: this.parseBoolean(this.getFieldValue(row, ['isCounterGuarantee', '是否反担保'])),
      counterGuaranteeId: this.getFieldValue(row, ['counterGuaranteeId', '反担保ID']),
      attributes: row,
      version: versionId,
      sourceFile,
      sourceRow: rowNumber,
      sourceBatch: batchId
    };
  }

  private parseCreditRow(
    row: Record<string, any>,
    sourceFile: string,
    batchId: string,
    versionId: string,
    rowNumber: number
  ): Omit<CreditLine, 'id' | 'createdAt' | 'updatedAt'> {
    const customerId = this.getFieldValue(row, ['customerId', '客户ID', '客户']);
    const totalAmount = this.parseNumber(this.getFieldValue(row, ['totalAmount', '授信总额', '总额度']));
    const asOfDate = this.getFieldValue(row, ['asOfDate', '数据日期', '余额日期']);

    if (!customerId) {
      throw new Error('缺少客户ID');
    }
    if (!asOfDate) {
      throw new Error('缺少数据日期');
    }

    const usedAmount = this.parseNumber(this.getFieldValue(row, ['usedAmount', '已用额度', '已用余额'])) || 0;
    const availableAmount = this.parseNumber(this.getFieldValue(row, ['availableAmount', '可用额度', '可用余额'])) || 
                          (totalAmount - usedAmount);

    return {
      customerId: String(customerId),
      totalAmount,
      usedAmount,
      availableAmount,
      asOfDate: this.parseDate(asOfDate) || new Date().toISOString().split('T')[0],
      currency: this.getFieldValue(row, ['currency', '币种', '货币']) || 'CNY',
      attributes: row,
      version: versionId,
      sourceFile,
      sourceRow: rowNumber,
      sourceBatch: batchId
    };
  }

  private parseCounterGuaranteeRow(
    row: Record<string, any>,
    sourceFile: string,
    batchId: string,
    versionId: string,
    rowNumber: number
  ): Omit<CounterGuarantee, 'id' | 'createdAt' | 'updatedAt'> {
    const guaranteeId = this.getFieldValue(row, ['guaranteeId', '担保合同ID', '主担保ID']);
    const providerId = this.getFieldValue(row, ['providerId', '反担保人ID', '反担保人']);
    const amount = this.parseNumber(this.getFieldValue(row, ['amount', '反担保金额', '金额']));

    if (!guaranteeId || !providerId) {
      throw new Error('缺少担保合同ID或反担保人ID');
    }
    if (amount <= 0) {
      throw new Error('反担保金额必须大于0');
    }

    return {
      guaranteeId: String(guaranteeId),
      providerId: String(providerId),
      type: this.getFieldValue(row, ['type', '反担保类型', '担保方式']) || '保证',
      amount,
      coverageRatio: this.parseNumber(this.getFieldValue(row, ['coverageRatio', '覆盖率'])) || 0,
      attributes: row,
      version: versionId,
      sourceFile,
      sourceRow: rowNumber,
      sourceBatch: batchId
    };
  }

  private getFieldValue(row: Record<string, any>, possibleNames: string[]): any {
    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        return row[name];
      }
      const lowerName = name.toLowerCase();
      for (const key of Object.keys(row)) {
        if (key.toLowerCase() === lowerName) {
          return row[key];
        }
      }
    }
    return undefined;
  }

  private parseNumber(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    const cleaned = String(value).replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  private parseDate(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') {
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) return value;
    }
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // ignore
    }
    return String(value);
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return lower === 'true' || lower === '是' || lower === 'yes' || lower === '1';
    }
    return false;
  }

  private getSampleData(parsedData: ParsedData): Record<string, any>[] {
    const allData = [
      ...parsedData.customers.slice(0, 3).map(c => ({ type: 'customer', ...c })),
      ...parsedData.guarantees.slice(0, 3).map(g => ({ type: 'guarantee', ...g })),
      ...parsedData.credits.slice(0, 3).map(c => ({ type: 'credit', ...c })),
      ...parsedData.counterGuarantees.slice(0, 3).map(cg => ({ type: 'counterGuarantee', ...cg }))
    ];
    return allData.slice(0, 10);
  }

  getImportBatch(batchId: string): ImportBatch | null {
    const batch = creditRepository.getImportBatch(batchId);
    if (batch) {
      batch.warnings = creditRepository.getWarningsByBatch(batchId);
    }
    return batch;
  }

  listImportBatches(limit = 50): ImportBatch[] {
    return creditRepository.listImportBatches(limit);
  }

  getBatchWarnings(batchId: string): DataImportWarning[] {
    return creditRepository.getWarningsByBatch(batchId);
  }

  getBatchTask(taskId: string): BatchTask | null {
    return creditRepository.getBatchTask(taskId);
  }
}

export const dataImportService = new DataImportService();
