import * as XLSX from 'xlsx';
import * as fs from 'fs';
import csv from 'csv-parser';
import { CreateReissueOrderRequest, CreateReissueItemRequest, IssueType } from '../types';
import { createReissueOrder } from './reissueService';

interface ImportRow {
  groupBuyCode: string;
  groupBuyName: string;
  leaderId: string;
  leaderName: string;
  leaderPhone: string;
  warehouseCode: string;
  warehouseName: string;
  originalOrderNo: string;
  originalOrderDate: string;
  productCode: string;
  productName: string;
  skuCode: string;
  skuName: string;
  issueType: string;
  originalQuantity: number;
  issueQuantity: number;
  reissueQuantity: number;
  unitPrice: number;
  remark: string;
}

export const importFromCSV = async (
  filePath: string,
  createdBy: string
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const results: ImportRow[] = [];
  const errors: string[] = [];

  return new Promise((resolve) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: Record<string, any>) => {
        try {
          results.push(mapCsvRow(data));
        } catch (e: any) {
          errors.push(`行 ${results.length + 2}: ${e.message}`);
        }
      })
      .on('end', async () => {
        const processed = await processImportData(results, createdBy, errors);
        resolve(processed);
      })
      .on('error', (err: Error) => {
        errors.push(`CSV读取错误: ${err.message}`);
        resolve({ success: 0, failed: 0, errors });
      });
  });
};

export const importFromExcel = async (
  filePath: string,
  createdBy: string
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const errors: string[] = [];
  const results: ImportRow[] = [];

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet) as any[];

    for (let i = 0; i < data.length; i++) {
      try {
        results.push(mapExcelRow(data[i], i + 2));
      } catch (e: any) {
        errors.push(`行 ${i + 2}: ${e.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`Excel读取错误: ${e.message}`);
    return { success: 0, failed: 0, errors };
  }

  return processImportData(results, createdBy, errors);
};

const mapCsvRow = (row: any): ImportRow => {
  return {
    groupBuyCode: String(row.groupBuyCode || row['团购编号'] || ''),
    groupBuyName: String(row.groupBuyName || row['团购名称'] || ''),
    leaderId: String(row.leaderId || row['团长ID'] || ''),
    leaderName: String(row.leaderName || row['团长姓名'] || ''),
    leaderPhone: String(row.leaderPhone || row['团长电话'] || ''),
    warehouseCode: String(row.warehouseCode || row['仓库编码'] || ''),
    warehouseName: String(row.warehouseName || row['仓库名称'] || ''),
    originalOrderNo: String(row.originalOrderNo || row['原订单号'] || ''),
    originalOrderDate: String(row.originalOrderDate || row['原订单日期'] || ''),
    productCode: String(row.productCode || row['商品编码'] || ''),
    productName: String(row.productName || row['商品名称'] || ''),
    skuCode: String(row.skuCode || row['SKU编码'] || ''),
    skuName: String(row.skuName || row['SKU名称'] || ''),
    issueType: String(row.issueType || row['问题类型'] || ''),
    originalQuantity: Number(row.originalQuantity || row['原数量'] || 0),
    issueQuantity: Number(row.issueQuantity || row['问题数量'] || 0),
    reissueQuantity: Number(row.reissueQuantity || row['补发数量'] || 0),
    unitPrice: Number(row.unitPrice || row['单价'] || 0),
    remark: String(row.remark || row['备注'] || '')
  };
};

const mapExcelRow = (row: any, lineNo: number): ImportRow => {
  const getValue = (keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        return String(row[key]);
      }
    }
    return '';
  };

  const getNumberValue = (keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && !isNaN(Number(row[key]))) {
        return Number(row[key]);
      }
    }
    return 0;
  };

  return {
    groupBuyCode: getValue(['groupBuyCode', '团购编号', '团购编码']),
    groupBuyName: getValue(['groupBuyName', '团购名称', '团购活动']),
    leaderId: getValue(['leaderId', '团长ID', '团长编号']),
    leaderName: getValue(['leaderName', '团长姓名', '团长']),
    leaderPhone: getValue(['leaderPhone', '团长电话', '手机号']),
    warehouseCode: getValue(['warehouseCode', '仓库编码', '仓库编号']),
    warehouseName: getValue(['warehouseName', '仓库名称', '仓库']),
    originalOrderNo: getValue(['originalOrderNo', '原订单号', '订单编号']),
    originalOrderDate: getValue(['originalOrderDate', '原订单日期', '订单日期']),
    productCode: getValue(['productCode', '商品编码', '商品编号']),
    productName: getValue(['productName', '商品名称', '商品']),
    skuCode: getValue(['skuCode', 'SKU编码', '规格编码']),
    skuName: getValue(['skuName', 'SKU名称', '规格名称']),
    issueType: getValue(['issueType', '问题类型', '类型']),
    originalQuantity: getNumberValue(['originalQuantity', '原数量', '订购数量']),
    issueQuantity: getNumberValue(['issueQuantity', '问题数量', '缺失数量']),
    reissueQuantity: getNumberValue(['reissueQuantity', '补发数量', '实际补发']),
    unitPrice: getNumberValue(['unitPrice', '单价', '价格']),
    remark: getValue(['remark', '备注', '说明'])
  };
};

const processImportData = async (
  rows: ImportRow[],
  createdBy: string,
  initialErrors: string[]
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const errors = [...initialErrors];

  const orderMap = new Map<string, { order: Omit<CreateReissueOrderRequest, 'items'>; items: CreateReissueItemRequest[] }>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!row.originalOrderNo) {
      errors.push(`行 ${i + 2}: 原订单号不能为空`);
      continue;
    }

    if (!row.productCode) {
      errors.push(`行 ${i + 2}: 商品编码不能为空`);
      continue;
    }

    let issueType: IssueType;
    const issueTypeLower = row.issueType.toLowerCase();
    if (issueTypeLower.includes('缺') || issueTypeLower.includes('missing')) {
      issueType = IssueType.MISSING;
    } else if (issueTypeLower.includes('错') || issueTypeLower.includes('wrong')) {
      issueType = IssueType.WRONG;
    } else if (issueTypeLower.includes('损') || issueTypeLower.includes('damaged')) {
      issueType = IssueType.DAMAGED;
    } else if (issueTypeLower.includes('期') || issueTypeLower.includes('expired')) {
      issueType = IssueType.EXPIRED;
    } else {
      issueType = IssueType.MISSING;
    }

    const item: CreateReissueItemRequest = {
      productCode: row.productCode,
      productName: row.productName,
      skuCode: row.skuCode,
      skuName: row.skuName,
      issueType,
      originalQuantity: row.originalQuantity,
      issueQuantity: row.issueQuantity,
      reissueQuantity: row.reissueQuantity,
      unitPrice: row.unitPrice,
      remark: row.remark
    };

    const orderKey = row.originalOrderNo;
    if (!orderMap.has(orderKey)) {
      orderMap.set(orderKey, {
        order: {
          groupBuyCode: row.groupBuyCode,
          groupBuyName: row.groupBuyName,
          leaderId: row.leaderId,
          leaderName: row.leaderName,
          leaderPhone: row.leaderPhone,
          warehouseCode: row.warehouseCode,
          warehouseName: row.warehouseName,
          originalOrderNo: row.originalOrderNo,
          originalOrderDate: row.originalOrderDate,
          remark: '',
          createdBy
        },
        items: []
      });
    }

    orderMap.get(orderKey)!.items.push(item);
  }

  let successCount = 0;
  let failedCount = 0;

  for (const [orderNo, orderData] of orderMap) {
    try {
      await createReissueOrder({
        ...orderData.order,
        items: orderData.items
      });
      successCount++;
    } catch (e: any) {
      failedCount++;
      errors.push(`订单 ${orderNo}: 导入失败 - ${e.message}`);
    }
  }

  return {
    success: successCount,
    failed: failedCount,
    errors
  };
};

export const generateTemplate = (outputPath: string, format: 'csv' | 'xlsx' = 'xlsx'): void => {
  const headers = [
    '团购编号', '团购名称', '团长ID', '团长姓名', '团长电话',
    '仓库编码', '仓库名称', '原订单号', '原订单日期',
    '商品编码', '商品名称', 'SKU编码', 'SKU名称',
    '问题类型', '原数量', '问题数量', '补发数量', '单价', '备注'
  ];

  const sampleData = [
    {
      '团购编号': 'GB202405001',
      '团购名称': '2024年5月水果团购',
      '团长ID': 'LD001',
      '团长姓名': '张三',
      '团长电话': '13800138001',
      '仓库编码': 'WH001',
      '仓库名称': '北京朝阳仓',
      '原订单号': 'ORD20240501001',
      '原订单日期': '2024-05-01',
      '商品编码': 'PRD001',
      '商品名称': '红富士苹果',
      'SKU编码': 'SKU001',
      'SKU名称': '5斤装',
      '问题类型': '缺件',
      '原数量': 10,
      '问题数量': 2,
      '补发数量': 2,
      '单价': 29.9,
      '备注': '配送时少2袋'
    },
    {
      '团购编号': 'GB202405001',
      '团购名称': '2024年5月水果团购',
      '团长ID': 'LD001',
      '团长姓名': '张三',
      '团长电话': '13800138001',
      '仓库编码': 'WH001',
      '仓库名称': '北京朝阳仓',
      '原订单号': 'ORD20240501001',
      '原订单日期': '2024-05-01',
      '商品编码': 'PRD002',
      '商品名称': '进口香蕉',
      'SKU编码': 'SKU002',
      'SKU名称': '3斤装',
      '问题类型': '错发',
      '原数量': 5,
      '问题数量': 1,
      '补发数量': 1,
      '单价': 19.9,
      '备注': '发成了普通香蕉'
    }
  ];

  if (format === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '补发单导入模板');
    XLSX.writeFile(workbook, outputPath);
  } else {
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => headers.map(h => `"${row[h as keyof typeof row] || ''}"`).join(','))
    ].join('\n');
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
  }
};
