import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type {
  Customer,
  Pledge,
  MarketData,
  SupplementRecord,
  ExtensionRecord,
  DisposalReport,
  HistoryRecord,
  PledgeCalculation,
  ImportDataType,
  ImportError,
  ImportWarning,
} from '../types';
import { generateId } from './calculator';

export const IMPORT_TEMPLATES: Record<ImportDataType, { headers: string[]; required: string[] }> = {
  customer: {
    headers: ['账户编号', '客户姓名', '风险等级', '联系电话'],
    required: ['账户编号', '客户姓名'],
  },
  pledge: {
    headers: ['账户编号', '股票代码', '股票名称', '质押股数', '融资本金', '警戒线(%)', '平仓线(%)', '开始日期', '到期日期'],
    required: ['账户编号', '股票代码', '质押股数', '融资本金', '警戒线(%)', '平仓线(%)'],
  },
  market: {
    headers: ['股票代码', '最新价', '昨收价', '交易状态', '估值折扣', '更新时间'],
    required: ['股票代码', '最新价', '交易状态'],
  },
  warningLine: {
    headers: ['账户编号', '股票代码', '警戒线(%)', '平仓线(%)', '展期后警戒线(%)'],
    required: ['账户编号', '警戒线(%)', '平仓线(%)'],
  },
  supplement: {
    headers: ['账户编号', '股票代码', '补仓金额', '预计到账日', '实际到账日', '状态'],
    required: ['账户编号', '补仓金额', '预计到账日'],
  },
  disposal: {
    headers: ['账户编号', '股票代码', '报告日期', '报告内容', '操作人', '状态'],
    required: ['账户编号', '报告日期', '报告内容'],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function validateImportData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[],
  type: ImportDataType,
  existingPledges: Pledge[],
  existingCustomers: Customer[]
): {
  errors: ImportError[];
  warnings: ImportWarning[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validData: any[];
} {
  const template = IMPORT_TEMPLATES[type];
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validData: any[] = [];

  data.forEach((row, index) => {
    const rowNum = index + 2;

    template.required.forEach((field) => {
      if (row[field] === undefined || row[field] === '') {
        errors.push({
          row: rowNum,
          field,
          message: `必填字段不能为空`,
        });
      }
    });

    if (type === 'pledge' && row['账户编号']) {
      const customerExists = existingCustomers.some((c) => c.accountNo === row['账户编号']);
      if (!customerExists) {
        warnings.push({
          row: rowNum,
          type: 'customer_not_found',
          message: `账户 ${row['账户编号']} 不存在，将自动创建`,
        });
      }
    }

    if (type === 'supplement' && row['账户编号'] && row['股票代码']) {
      const pledgeExists = existingPledges.some(
        (p) => p.customerId === row['账户编号'] && p.stockCode === row['股票代码']
      );
      if (!pledgeExists) {
        errors.push({
          row: rowNum,
          field: '账户编号/股票代码',
          message: `找不到对应的质押合约`,
        });
      }
    }

    if (errors.filter((e) => e.row === rowNum).length === 0) {
      validData.push({ ...row, _rowNum: rowNum });
    }
  });

  return { errors, warnings, validData };
}

export function transformImportData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[],
  type: ImportDataType,
  existingPledges: Pledge[],
  existingCustomers: Customer[]
): {
  customers: Customer[];
  pledges: Pledge[];
  marketData: MarketData[];
  supplements: SupplementRecord[];
  extensions: ExtensionRecord[];
  disposals: DisposalReport[];
} {
  const result = {
    customers: [] as Customer[],
    pledges: [] as Pledge[],
    marketData: [] as MarketData[],
    supplements: [] as SupplementRecord[],
    extensions: [] as ExtensionRecord[],
    disposals: [] as DisposalReport[],
  };

  const now = new Date().toISOString();

  data.forEach((row) => {
    switch (type) {
      case 'customer': {
        const existing = existingCustomers.find((c) => c.accountNo === row['账户编号']);
        if (!existing) {
          result.customers.push({
            id: generateId(),
            accountNo: row['账户编号'],
            customerName: row['客户姓名'],
            riskLevel: row['风险等级']?.toLowerCase() || 'medium',
            phone: row['联系电话'],
          });
        }
        break;
      }

      case 'pledge': {
        let customerId = row['账户编号'];
        const customer = existingCustomers.find((c) => c.accountNo === row['账户编号']);
        if (customer) {
          customerId = customer.id;
        } else {
          const newCustomer: Customer = {
            id: generateId(),
            accountNo: row['账户编号'],
            customerName: row['客户姓名'] || '未知客户',
            riskLevel: 'medium',
          };
          result.customers.push(newCustomer);
          customerId = newCustomer.id;
        }

        result.pledges.push({
          id: generateId(),
          customerId,
          stockCode: row['股票代码'],
          stockName: row['股票名称'] || row['股票代码'],
          pledgeShares: parseFloat(row['质押股数']) || 0,
          principal: parseFloat(row['融资本金']) || 0,
          warningLine: parseFloat(row['警戒线(%)']) || 160,
          closeLine: parseFloat(row['平仓线(%)']) || 140,
          startDate: row['开始日期'] || now.split('T')[0],
          endDate: row['到期日期'] || '',
          status: 'normal',
          specialFlags: [],
          createdAt: now,
          updatedAt: now,
        });
        break;
      }

      case 'market': {
        result.marketData.push({
          id: generateId(),
          stockCode: row['股票代码'],
          latestPrice: parseFloat(row['最新价']) || 0,
          previousClose: parseFloat(row['昨收价']) || parseFloat(row['最新价']) || 0,
          tradingStatus: row['交易状态'] === '停牌' ? 'suspended' : row['交易状态'] === '临时停牌' ? 'halted' : 'normal',
          valuationDiscount: parseFloat(row['估值折扣']) || 0.8,
          updateTime: row['更新时间'] || now,
        });
        break;
      }

      case 'warningLine': {
        const pledge = existingPledges.find(
          (p) => p.customerId === row['账户编号'] && p.stockCode === row['股票代码']
        );
        if (pledge) {
          pledge.warningLine = parseFloat(row['警戒线(%)']) || pledge.warningLine;
          pledge.closeLine = parseFloat(row['平仓线(%)']) || pledge.closeLine;
          pledge.updatedAt = now;
          result.pledges.push(pledge);
        }
        break;
      }

      case 'supplement': {
        const pledge = existingPledges.find(
          (p) => p.customerId === row['账户编号'] && p.stockCode === row['股票代码']
        );
        if (pledge) {
          result.supplements.push({
            id: generateId(),
            pledgeId: pledge.id,
            amount: parseFloat(row['补仓金额']) || 0,
            expectedDate: row['预计到账日'],
            actualDate: row['实际到账日'] || undefined,
            status: row['状态'] === '已到账' ? 'received' : row['状态'] === '已取消' ? 'cancelled' : 'pending',
            afterPledgeRatio: 0,
          });
        }
        break;
      }

      case 'disposal': {
        const pledge = existingPledges.find(
          (p) => p.customerId === row['账户编号'] && p.stockCode === row['股票代码']
        );
        if (pledge) {
          result.disposals.push({
            id: generateId(),
            pledgeId: pledge.id,
            reportDate: row['报告日期'],
            reportContent: row['报告内容'],
            operator: row['操作人'] || '风控人员',
            status: row['状态'] === '已提交' ? 'submitted' : row['状态'] === '已完成' ? 'completed' : 'draft',
          });
        }
        break;
      }
    }
  });

  return result;
}

export interface ExportReportData {
  customers: Customer[];
  pledges: Pledge[];
  marketData: Record<string, MarketData>;
  supplements: SupplementRecord[];
  extensions: ExtensionRecord[];
  disposals: DisposalReport[];
  history: HistoryRecord[];
  calculations: Map<string, PledgeCalculation>;
  statistics: {
    totalWarning: number;
    pendingSupplement: number;
    pendingExtension: number;
    pendingDisposal: number;
    specialCases: number;
    exportTime: string;
  };
}

export function generateExportReport(data: ExportReportData): Blob {
  const wb = XLSX.utils.book_new();

  const overviewData = [
    ['股票质押预警处置报告'],
    [`导出时间: ${data.statistics.exportTime}`],
    [],
    ['统计概览'],
    ['指标', '数量'],
    ['今日触线总数', data.statistics.totalWarning],
    ['待补仓', data.statistics.pendingSupplement],
    ['待展期', data.statistics.pendingExtension],
    ['待处置', data.statistics.pendingDisposal],
    ['特殊场景', data.statistics.specialCases],
    [],
    ['预警客户明细'],
    ['账户编号', '客户姓名', '股票代码', '股票名称', '质押率(%)', '警戒线(%)', '平仓线(%)', '状态', '特殊标记'],
    ...data.pledges
      .filter((p) => {
        const calc = data.calculations.get(p.id);
        return calc?.isWarning;
      })
      .map((p) => {
        const calc = data.calculations.get(p.id);
        const customer = data.customers.find((c) => c.id === p.customerId);
        return [
          customer?.accountNo || p.customerId,
          customer?.customerName || '',
          p.stockCode,
          p.stockName,
          calc?.pledgeRatio.toFixed(2) || '',
          calc?.effectiveWarningLine.toFixed(2) || p.warningLine.toFixed(2),
          p.closeLine.toFixed(2),
          formatPledgeStatus(p.status),
          p.specialFlags.map((f) => formatSpecialFlag(f)).join('、'),
        ];
      }),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, ws1, '预警概览');

  const detailData = [
    ['客户明细数据'],
    ['账户编号', '客户姓名', '风险等级', '股票代码', '股票名称', '质押股数', '融资本金', '质押市值', '质押率(%)', '警戒线(%)', '平仓线(%)', '开始日期', '到期日期', '状态'],
    ...data.pledges.map((p) => {
      const calc = data.calculations.get(p.id);
      const customer = data.customers.find((c) => c.id === p.customerId);
      return [
        customer?.accountNo || p.customerId,
        customer?.customerName || '',
        formatRiskLevel(customer?.riskLevel || 'medium'),
        p.stockCode,
        p.stockName,
        p.pledgeShares,
        p.principal,
        calc?.marketValue || 0,
        calc?.pledgeRatio.toFixed(2) || '',
        calc?.effectiveWarningLine.toFixed(2) || p.warningLine.toFixed(2),
        p.closeLine.toFixed(2),
        p.startDate,
        p.endDate,
        formatPledgeStatus(p.status),
      ];
    }),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(detailData);
  XLSX.utils.book_append_sheet(wb, ws2, '客户明细');

  const supplementData = [
    ['补仓记录'],
    ['账户编号', '客户姓名', '股票代码', '补仓金额', '预计到账日', '实际到账日', '状态', '补仓后质押率(%)'],
    ...data.supplements.map((s) => {
      const pledge = data.pledges.find((p) => p.id === s.pledgeId);
      const customer = data.customers.find((c) => c.id === pledge?.customerId);
      return [
        customer?.accountNo || '',
        customer?.customerName || '',
        pledge?.stockCode || '',
        s.amount,
        s.expectedDate,
        s.actualDate || '',
        formatSupplementStatus(s.status),
        s.afterPledgeRatio.toFixed(2),
      ];
    }),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(supplementData);
  XLSX.utils.book_append_sheet(wb, ws3, '补仓记录');

  const extensionData = [
    ['展期记录'],
    ['账户编号', '客户姓名', '股票代码', '申请日期', '审批日期', '新到期日', '新警戒线(%)', '状态'],
    ...data.extensions.map((e) => {
      const pledge = data.pledges.find((p) => p.id === e.pledgeId);
      const customer = data.customers.find((c) => c.id === pledge?.customerId);
      return [
        customer?.accountNo || '',
        customer?.customerName || '',
        pledge?.stockCode || '',
        e.applyDate,
        e.approveDate || '',
        e.newEndDate,
        e.newWarningLine.toFixed(2),
        formatExtensionStatus(e.status),
      ];
    }),
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(extensionData);
  XLSX.utils.book_append_sheet(wb, ws4, '展期记录');

  const disposalData = [
    ['处置记录'],
    ['账户编号', '客户姓名', '股票代码', '报告日期', '报告内容', '操作人', '状态'],
    ...data.disposals.map((d) => {
      const pledge = data.pledges.find((p) => p.id === d.pledgeId);
      const customer = data.customers.find((c) => c.id === pledge?.customerId);
      return [
        customer?.accountNo || '',
        customer?.customerName || '',
        pledge?.stockCode || '',
        d.reportDate,
        d.reportContent,
        d.operator,
        formatDisposalStatus(d.status),
      ];
    }),
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(disposalData);
  XLSX.utils.book_append_sheet(wb, ws5, '处置记录');

  const historyData = [
    ['操作日志'],
    ['操作时间', '操作人', '操作类型', '字段', '变更前', '变更后'],
    ...data.history
      .sort((a, b) => new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime())
      .map((h) => [
        h.operateTime,
        h.operator,
        formatOperationType(h.operationType),
        h.fieldName,
        h.beforeValue,
        h.afterValue,
      ]),
  ];
  const ws6 = XLSX.utils.aoa_to_sheet(historyData);
  XLSX.utils.book_append_sheet(wb, ws6, '操作日志');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadReport(blob: Blob, filename?: string): void {
  const exportDate = new Date().toISOString().split('T')[0];
  const reportName = filename || `股票质押预警处置报告_${exportDate}.xlsx`;
  saveAs(blob, reportName);
}

export function generateImportTemplate(type: ImportDataType): Blob {
  const template = IMPORT_TEMPLATES[type];
  const headers = [template.headers];
  const ws = XLSX.utils.aoa_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function formatPledgeStatus(status: string): string {
  const map: Record<string, string> = {
    normal: '正常',
    warning: '预警',
    close: '平仓',
    extended: '已展期',
    disposed: '已处置',
  };
  return map[status] || status;
}

function formatSpecialFlag(flag: string): string {
  const map: Record<string, string> = {
    suspended: '停牌估值',
    supplement_pending: '补仓未到账',
    extension_old: '展期旧任务',
    extension_pending: '展期待批',
  };
  return map[flag] || flag;
}

function formatRiskLevel(level: string): string {
  const map: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return map[level] || level;
}

function formatSupplementStatus(status: string): string {
  const map: Record<string, string> = {
    pending: '待到账',
    received: '已到账',
    cancelled: '已取消',
  };
  return map[status] || status;
}

function formatExtensionStatus(status: string): string {
  const map: Record<string, string> = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已拒绝',
  };
  return map[status] || status;
}

function formatDisposalStatus(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    submitted: '已提交',
    completed: '已完成',
  };
  return map[status] || status;
}

function formatOperationType(type: string): string {
  const map: Record<string, string> = {
    status_update: '状态更新',
    supplement: '补仓操作',
    extension: '展期操作',
    disposal: '处置操作',
    import: '数据导入',
  };
  return map[type] || type;
}
