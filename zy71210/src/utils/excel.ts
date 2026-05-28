import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import {
  PurchaseContract,
  InventoryLot,
  FuturesPosition,
  BasisRecord,
  ExposureResult,
  ExposureConfig,
  RolloverRecord,
  AuditLog,
  WarningItem,
  DataType,
  ImportResult,
} from '../types';
import { formatQuantity, formatCurrency } from './calculator';

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const fieldMappings: Record<DataType, Record<string, string>> = {
  contracts: {
    contractNo: '合同编号',
    supplier: '供应商',
    copperGrade: '铜品种',
    quantity: '数量(吨)',
    price: '单价(元/吨)',
    deliveryDate: '交货日期',
    arrivalDate: '到货日期',
    status: '状态',
  },
  lots: {
    lotNo: '批次号',
    contractId: '关联合同编号',
    quantity: '数量(吨)',
    warehouse: '仓库',
    receiptDate: '入库日期',
    matchStatus: '匹配状态',
    notes: '备注',
  },
  positions: {
    contractMonth: '合约月份',
    direction: '方向',
    quantity: '数量(吨)',
    openPrice: '开仓价',
    currentPrice: '当前价',
    openDate: '开仓日期',
    deliveryMonth: '交割月',
    status: '状态',
  },
  basis: {
    positionId: '关联持仓ID',
    basisDate: '日期',
    spotPrice: '现货价',
    futuresPrice: '期货价',
    basisValue: '基差',
    isLocked: '是否锁定',
  },
  rollovers: {
    fromPositionId: '原持仓ID',
    toPositionId: '新持仓ID',
    rolloverDate: '移仓日期',
    closePrice: '平仓价',
    openPrice: '开仓价',
    rolloverCost: '移仓成本',
    quantity: '数量(吨)',
    reason: '移仓原因',
    isComplete: '是否完成',
  },
};

const parseDate = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'number') {
    return dayjs(new Date(1899, 11, 30 + value)).format('YYYY-MM-DD');
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : String(value);
};

const parseNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

const parseBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['是', 'true', 'yes', '1', '锁定'].includes(value.toLowerCase());
  }
  return false;
};

export interface ParseResult<T> {
  data: T[];
  errors: string[];
  warnings: string[];
}

export function parseExcelFile<T>(file: File, dataType: DataType): Promise<ParseResult<T>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

        const result = parseJsonData<T>(jsonData, dataType);
        resolve(result);
      } catch (error) {
        reject(new Error(`文件解析失败: ${(error as Error).message}`));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

function parseJsonData<T>(jsonData: any[], dataType: DataType): ParseResult<T> {
  const data: T[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const mappings = fieldMappings[dataType];

  jsonData.forEach((row, index) => {
    try {
      const parsed = parseRow(row, dataType, index + 2);
      if (parsed) {
        data.push(parsed as T);
      }
    } catch (error) {
      errors.push(`第 ${index + 2} 行: ${(error as Error).message}`);
    }
  });

  if (data.length === 0) {
    warnings.push('未解析到有效数据，请检查文件格式和字段名称');
  }

  return { data, errors, warnings };
}

function parseRow(row: any, dataType: DataType, rowNum: number): any {
  const getValue = (field: string) => {
    const mapping = fieldMappings[dataType];
    const possibleNames = [field, mapping[field], field.toLowerCase()];
    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        return row[name];
      }
    }
    return undefined;
  };

  switch (dataType) {
    case 'contracts': {
      const contractNo = getValue('contractNo') as string;
      const supplier = getValue('supplier') as string;
      const quantity = parseNumber(getValue('quantity'));
      const price = parseNumber(getValue('price'));
      const deliveryDate = parseDate(getValue('deliveryDate'));

      if (!contractNo) throw new Error('合同编号不能为空');
      if (!supplier) throw new Error('供应商不能为空');
      if (quantity <= 0) throw new Error('数量必须大于0');

      return {
        id: generateId(),
        contractNo,
        supplier,
        copperGrade: (getValue('copperGrade') as string) || 'A级阴极铜',
        quantity,
        price,
        deliveryDate,
        arrivalDate: parseDate(getValue('arrivalDate')),
        status: (getValue('status') as string) || 'pending',
        createdAt: new Date().toISOString(),
      } as PurchaseContract;
    }

    case 'lots': {
      const lotNo = getValue('lotNo') as string;
      const quantity = parseNumber(getValue('quantity'));
      const receiptDate = parseDate(getValue('receiptDate'));

      if (!lotNo) throw new Error('批次号不能为空');
      if (quantity <= 0) throw new Error('数量必须大于0');
      if (!receiptDate) throw new Error('入库日期不能为空');

      return {
        id: generateId(),
        lotNo,
        contractId: (getValue('contractId') as string) || '',
        quantity,
        warehouse: (getValue('warehouse') as string) || '默认仓库',
        receiptDate,
        matchStatus: (getValue('matchStatus') as any) || 'unmatched',
        notes: (getValue('notes') as string) || '',
      } as InventoryLot;
    }

    case 'positions': {
      const contractMonth = getValue('contractMonth') as string;
      const quantity = parseNumber(getValue('quantity'));
      const openPrice = parseNumber(getValue('openPrice'));
      const openDate = parseDate(getValue('openDate'));
      const deliveryMonth = getValue('deliveryMonth') as string;

      if (!contractMonth) throw new Error('合约月份不能为空');
      if (quantity <= 0) throw new Error('数量必须大于0');
      if (!openDate) throw new Error('开仓日期不能为空');

      return {
        id: generateId(),
        contractMonth,
        direction: (getValue('direction') as string) === '买入' ? 'long' : 'short',
        quantity,
        openPrice,
        currentPrice: parseNumber(getValue('currentPrice')) || openPrice,
        openDate,
        deliveryMonth: deliveryMonth || contractMonth,
        isRollover: false,
        status: (getValue('status') as string) || 'open',
      } as FuturesPosition;
    }

    case 'basis': {
      const basisDate = parseDate(getValue('basisDate'));
      const spotPrice = parseNumber(getValue('spotPrice'));
      const futuresPrice = parseNumber(getValue('futuresPrice'));

      if (!basisDate) throw new Error('基差日期不能为空');
      if (spotPrice <= 0) throw new Error('现货价必须大于0');
      if (futuresPrice <= 0) throw new Error('期货价必须大于0');

      return {
        id: generateId(),
        positionId: (getValue('positionId') as string) || '',
        basisDate,
        spotPrice,
        futuresPrice,
        basisValue: spotPrice - futuresPrice,
        isLocked: parseBoolean(getValue('isLocked')),
      } as BasisRecord;
    }

    default:
      throw new Error(`未知数据类型: ${dataType}`);
  }
}

export function generateIdForImport(): string {
  return generateId();
}

export interface ExportOptions {
  format: 'xlsx' | 'csv';
  include: {
    summary?: boolean;
    monthly?: boolean;
    lots?: boolean;
    positions?: boolean;
    warnings?: boolean;
    audit?: boolean;
    basis?: boolean;
    rollovers?: boolean;
  };
}

export function exportToFile(
  result: ExposureResult,
  config: ExposureConfig,
  lots: InventoryLot[],
  positions: FuturesPosition[],
  basisRecords: BasisRecord[],
  rollovers: RolloverRecord[],
  auditLogs: AuditLog[],
  options: ExportOptions
): void {
  const wb = XLSX.utils.book_new();
  const { include, format } = options;

  if (include.summary) {
    const summaryData = [
      ['期货套保敞口复核报告'],
      ['生成时间', new Date().toLocaleString('zh-CN')],
      ['计算方法', config.calculationMethod === 'gross' ? '总额法' : config.calculationMethod === 'net' ? '净额法' : '加权法'],
      ['日期范围', `${config.dateRange.start} 至 ${config.dateRange.end}`],
      ['套保比例', `${(config.hedgingRatio * 100).toFixed(0)}%`],
      [],
      ['一、敞口汇总'],
      ['项目', '数值(吨)', '金额(元)'],
      ['现货总敞口', formatQuantity(result.totalSpotExposure), ''],
      ['期货套保量', formatQuantity(result.totalFuturesHedge), ''],
      ['净敞口', formatQuantity(result.netExposure), ''],
      ['基差风险', '', formatCurrency(result.basisRisk)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, '敞口汇总');
  }

  if (include.monthly && result.byDeliveryMonth) {
    const monthlyData = [
      ['二、按月明细'],
      ['交割月', '现货敞口(吨)', '期货套保(吨)', '净敞口(吨)'],
      ...Object.entries(result.byDeliveryMonth).map(([month, data]) => [
        month,
        data.spot,
        data.futures,
        data.net,
      ]),
      [
        '合计',
        Object.values(result.byDeliveryMonth).reduce((s, d) => s + d.spot, 0),
        Object.values(result.byDeliveryMonth).reduce((s, d) => s + d.futures, 0),
        Object.values(result.byDeliveryMonth).reduce((s, d) => s + d.net, 0),
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(monthlyData);
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, '按月明细');
  }

  if (include.lots && lots.length > 0) {
    const lotsData = lots.map((lot) => ({
      批次号: lot.lotNo,
      关联合同: lot.contractId,
      数量: lot.quantity,
      仓库: lot.warehouse,
      入库日期: lot.receiptDate,
      匹配状态:
        lot.matchStatus === 'matched'
          ? '已匹配'
          : lot.matchStatus === 'mismatch'
          ? '错配'
          : '未匹配',
      匹配持仓ID: lot.matchedPositionId || '',
      备注: lot.notes || '',
      错配原因: lot.mismatchReason || '',
    }));
    const ws = XLSX.utils.json_to_sheet(lotsData);
    XLSX.utils.book_append_sheet(wb, ws, '现货批次');
  }

  if (include.positions && positions.length > 0) {
    const positionsData = positions.map((pos) => ({
      合约月份: pos.contractMonth,
      方向: pos.direction === 'short' ? '卖出' : '买入',
      数量: pos.quantity,
      开仓价: pos.openPrice,
      当前价: pos.currentPrice,
      开仓日期: pos.openDate,
      交割月: pos.deliveryMonth,
      状态: pos.status === 'open' ? '持有中' : pos.status === 'closed' ? '已平仓' : '已移仓',
      是否移仓: pos.isRollover ? '是' : '否',
      套保批次ID: pos.hedgedLotId || '',
      浮动盈亏: pos.pnl || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(positionsData);
    XLSX.utils.book_append_sheet(wb, ws, '期货持仓');
  }

  if (include.warnings && result.warnings.length > 0) {
    const warningsData = result.warnings.map((w) => ({
      风险等级:
        w.severity === 'high'
          ? '高风险'
          : w.severity === 'medium'
          ? '中风险'
          : '提示',
      预警类型: getWarningTypeText(w.type),
      预警标题: w.title,
      详细描述: w.description,
      操作建议: w.suggestion,
    }));
    const ws = XLSX.utils.json_to_sheet(warningsData);
    XLSX.utils.book_append_sheet(wb, ws, '风险预警');
  }

  if (include.basis && basisRecords.length > 0) {
    const basisData = basisRecords.map((b) => ({
      日期: b.basisDate,
      关联持仓ID: b.positionId,
      现货价: b.spotPrice,
      期货价: b.futuresPrice,
      基差: b.basisValue,
      是否已锁定: b.isLocked ? '是' : '否',
    }));
    const ws = XLSX.utils.json_to_sheet(basisData);
    XLSX.utils.book_append_sheet(wb, ws, '基差记录');
  }

  if (include.rollovers && rollovers.length > 0) {
    const rolloverData = rollovers.map((r) => ({
      移仓日期: r.rolloverDate,
      原持仓ID: r.fromPositionId,
      新持仓ID: r.toPositionId,
      平仓价: r.closePrice,
      开仓价: r.openPrice,
      移仓数量: r.quantity,
      移仓成本: r.rolloverCost,
      移仓原因: r.reason,
      是否已完成: r.isComplete ? '是' : '否',
    }));
    const ws = XLSX.utils.json_to_sheet(rolloverData);
    XLSX.utils.book_append_sheet(wb, ws, '移仓记录');
  }

  if (include.audit && auditLogs.length > 0) {
    const auditData = auditLogs.map((log) => ({
      修改时间: new Date(log.timestamp).toLocaleString('zh-CN'),
      数据类型: getEntityTypeText(log.entityType),
      实体ID: log.entityId,
      修改字段: getFieldNameText(log.fieldName),
      原值: JSON.stringify(log.oldValue),
      新值: JSON.stringify(log.newValue),
      修改理由: log.reason,
      操作人: log.operator,
    }));
    const ws = XLSX.utils.json_to_sheet(auditData);
    XLSX.utils.book_append_sheet(wb, ws, '修改记录');
  }

  const fileName = `套保敞口复核报告_${dayjs().format('YYYYMMDD_HHmmss')}`;

  if (format === 'xlsx') {
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  } else {
    const firstSheetName = wb.SheetNames[0];
    const firstSheet = wb.Sheets[firstSheetName];
    const csv = XLSX.utils.sheet_to_csv(firstSheet);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.csv`;
    link.click();
  }
}

function getWarningTypeText(type: string): string {
  const map: Record<string, string> = {
    mismatch: '批次错配',
    rollover: '移仓异常',
    basis_duplicate: '基差重复扣减',
    other: '其他',
  };
  return map[type] || type;
}

function getEntityTypeText(type: string): string {
  const map: Record<string, string> = {
    lot: '库存批次',
    position: '期货持仓',
    contract: '采购合同',
    config: '计算配置',
    basis: '基差记录',
  };
  return map[type] || type;
}

function getFieldNameText(field: string): string {
  const map: Record<string, string> = {
    quantity: '数量',
    matchedPositionId: '匹配持仓ID',
    matchStatus: '匹配状态',
    hedgedLotId: '套保批次ID',
    status: '状态',
    price: '价格',
    deliveryDate: '交货日期',
    hedgingRatio: '套保比例',
    notes: '备注',
  };
  return map[field] || field;
}

export function validateRow(row: any, dataType: DataType): string[] {
  const errors: string[] = [];

  switch (dataType) {
    case 'contracts':
      if (!row.contractNo) errors.push('合同编号不能为空');
      if (!row.supplier) errors.push('供应商不能为空');
      if (row.quantity <= 0) errors.push('数量必须大于0');
      break;
    case 'lots':
      if (!row.lotNo) errors.push('批次号不能为空');
      if (row.quantity <= 0) errors.push('数量必须大于0');
      break;
    case 'positions':
      if (!row.contractMonth) errors.push('合约月份不能为空');
      if (row.quantity <= 0) errors.push('数量必须大于0');
      break;
    case 'basis':
      if (row.spotPrice <= 0) errors.push('现货价必须大于0');
      if (row.futuresPrice <= 0) errors.push('期货价必须大于0');
      break;
  }

  return errors;
}

export function downloadTemplate(dataType: DataType): void {
  const mappings = fieldMappings[dataType];
  const headers = Object.values(mappings);
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const typeNames: Record<DataType, string> = {
    contracts: '采购合同',
    lots: '库存批次',
    positions: '期货持仓',
    basis: '基差数据',
    rollovers: '移仓记录',
  };

  XLSX.writeFile(wb, `${typeNames[dataType]}_导入模板.xlsx`);
}
