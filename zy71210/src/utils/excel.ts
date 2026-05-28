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

const fieldAliases: Record<DataType, Record<string, string[]>> = {
  contracts: {
    contractNo: ['contractNo', '合同编号', '合同号', '合约编号', 'ContractNo', 'contract_no', '合同编码'],
    supplier: ['supplier', '供应商', '供货商', 'Supplier', 'supplier_name', '供方'],
    copperGrade: ['copperGrade', '铜品种', '品种', '牌号', 'CopperGrade', 'grade'],
    quantity: ['quantity', '数量(吨)', '数量', '吨数', 'Quantity', 'qty', '重量(吨)'],
    price: ['price', '单价(元/吨)', '单价', '价格', 'Price', 'unit_price'],
    deliveryDate: ['deliveryDate', '交货日期', '交货日', 'DeliveryDate', 'delivery_date', '交期'],
    arrivalDate: ['arrivalDate', '到货日期', '到货日', 'ArrivalDate', 'arrival_date', '入库日期'],
    status: ['status', '状态', 'Status', '合同状态'],
  },
  lots: {
    lotNo: ['lotNo', '批次号', '批次编号', 'LotNo', 'lot_no', '批号'],
    contractId: ['contractId', '关联合同编号', '关联合同', '合同编号', 'contract_id', '合同号'],
    quantity: ['quantity', '数量(吨)', '数量', '吨数', 'Quantity', 'qty'],
    warehouse: ['warehouse', '仓库', 'Warehouse', 'storage', '库房', '存放地点'],
    receiptDate: ['receiptDate', '入库日期', '到货日期', 'ReceiptDate', 'receipt_date', '入库日'],
    matchStatus: ['matchStatus', '匹配状态', '状态', 'MatchStatus'],
    notes: ['notes', '备注', '说明', 'Notes', 'remark', 'remarks'],
  },
  positions: {
    contractMonth: ['contractMonth', '合约月份', '合约', 'ContractMonth', 'contract_month', '月份'],
    direction: ['direction', '方向', 'Direction', '买卖方向', '持仓方向', '多空'],
    quantity: ['quantity', '数量(吨)', '数量', '手数', 'Quantity', 'qty', '持仓量'],
    openPrice: ['openPrice', '开仓价', 'OpenPrice', 'open_price', '开仓价格'],
    currentPrice: ['currentPrice', '当前价', '现价', 'CurrentPrice', 'current_price', '最新价'],
    openDate: ['openDate', '开仓日期', '开仓日', 'OpenDate', 'open_date', '建仓日期'],
    deliveryMonth: ['deliveryMonth', '交割月', '交割月份', 'DeliveryMonth', 'delivery_month'],
    status: ['status', '状态', 'Status', '持仓状态'],
  },
  basis: {
    positionId: ['positionId', '关联持仓ID', '持仓ID', 'PositionId', 'position_id'],
    basisDate: ['basisDate', '日期', '基差日期', 'BasisDate', 'basis_date', '计算日期'],
    spotPrice: ['spotPrice', '现货价', '现货价格', 'SpotPrice', 'spot_price'],
    futuresPrice: ['futuresPrice', '期货价', '期货价格', 'FuturesPrice', 'futures_price'],
    basisValue: ['basisValue', '基差', 'BasisValue', 'basis_value'],
    isLocked: ['isLocked', '是否锁定', '锁定', 'IsLocked', 'locked', '是否已锁定'],
  },
  rollovers: {
    fromPositionId: ['fromPositionId', '原持仓ID', 'FromPositionId'],
    toPositionId: ['toPositionId', '新持仓ID', 'ToPositionId'],
    rolloverDate: ['rolloverDate', '移仓日期', 'RolloverDate'],
    closePrice: ['closePrice', '平仓价', 'ClosePrice'],
    openPrice: ['openPrice', '开仓价', 'OpenPrice'],
    rolloverCost: ['rolloverCost', '移仓成本', 'RolloverCost'],
    quantity: ['quantity', '数量(吨)', '数量', 'Quantity'],
    reason: ['reason', '移仓原因', 'Reason'],
    isComplete: ['isComplete', '是否完成', 'IsComplete'],
  },
};

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
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').replace(/，/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  }
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

const parseBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['是', 'true', 'yes', '1', '锁定', '已锁定'].includes(value.toLowerCase());
  }
  return false;
};

const detectEncoding = (buffer: ArrayBuffer): string => {
  const uint8 = new Uint8Array(buffer);

  if (uint8.length >= 3 && uint8[0] === 0xef && uint8[1] === 0xbb && uint8[2] === 0xbf) {
    return 'utf-8';
  }

  let hasHighByte = false;
  for (let i = 0; i < Math.min(uint8.length, 1000); i++) {
    if (uint8[i] > 127) {
      hasHighByte = true;
      break;
    }
  }

  return hasHighByte ? 'gbk' : 'utf-8';
};

const decodeText = (buffer: ArrayBuffer, encoding: string): string => {
  try {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer);
  } catch (e) {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
};

const normalizeRowKeys = (row: any, dataType: DataType): any => {
  const normalized: any = {};
  const aliases = fieldAliases[dataType];

  Object.keys(aliases).forEach((field) => {
    const possibleNames = aliases[field];

    for (const name of possibleNames) {
      const lowerName = name.toLowerCase().trim();

      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        normalized[field] = row[name];
        break;
      }

      const foundKey = Object.keys(row).find(
        (k) => k.toLowerCase().trim() === lowerName
      );

      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
        normalized[field] = row[foundKey];
        break;
      }
    }
  });

  return normalized;
};

export interface ParseResult<T> {
  data: T[];
  errors: string[];
  warnings: string[];
}

const parseCsvFile = async <T>(csvText: string, dataType: DataType): Promise<ParseResult<T>> => {
  try {
    const workbook = XLSX.read(csvText, { type: 'string' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

    return parseJsonData<T>(jsonData, dataType);
  } catch (error) {
    throw new Error(`CSV解析失败: ${(error as Error).message}`);
  }
};

export function parseExcelFile<T>(file: File, dataType: DataType): Promise<ParseResult<T>> {
  return new Promise((resolve, reject) => {
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (isCSV) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const encoding = detectEncoding(buffer);
          const text = decodeText(buffer, encoding);
          const result = await parseCsvFile<T>(text, dataType);
          resolve(result);
        } catch (error) {
          reject(new Error(`CSV文件解析失败: ${(error as Error).message}`));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    } else {
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
    }
  });
}

function parseJsonData<T>(jsonData: any[], dataType: DataType): ParseResult<T> {
  const data: T[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (jsonData.length > 0) {
    const firstRowKeys = Object.keys(jsonData[0]);
    const expectedFields = Object.keys(fieldMappings[dataType]);
    const matchedFields = expectedFields.filter((field) => {
      const aliases = fieldAliases[dataType][field];
      return firstRowKeys.some((key) => aliases.some((alias) => key.toLowerCase().includes(alias.toLowerCase())));
    });

    if (matchedFields.length === 0) {
      warnings.push('未匹配到字段，请检查表头名称是否正确');
      warnings.push(`期望字段：${expectedFields.map((f) => fieldMappings[dataType][f]).join('、')}`);
    } else if (matchedFields.length < expectedFields.length / 2) {
      warnings.push('部分字段未匹配到，可能影响解析结果');
    }
  }

  jsonData.forEach((row, index) => {
    try {
      const normalizedRow = normalizeRowKeys(row, dataType);
      const parsed = parseRow(normalizedRow, dataType, index + 2);
      if (parsed) {
        data.push(parsed as T);
      }
    } catch (error) {
      errors.push(`第 ${index + 2} 行: ${(error as Error).message}`);
    }
  });

  if (data.length === 0 && jsonData.length > 0) {
    warnings.push('未解析到有效数据，请检查文件格式和字段名称');
    warnings.push('可点击"下载模板"获取标准模板');
  }

  return { data, errors, warnings };
}

function parseRow(row: any, dataType: DataType, rowNum: number): any {
  const getValue = (field: string) => {
    if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
      return row[field];
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

      const direction = getValue('direction') as string;
      const directionValue = direction === '买入' || direction?.toLowerCase() === 'long' || direction?.toLowerCase() === '多' ? 'long' : 'short';

      return {
        id: generateId(),
        contractMonth,
        direction: directionValue,
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
