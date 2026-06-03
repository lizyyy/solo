import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportRowData } from '@/types';

export interface ParseResult {
  data: ImportRowData[];
  errors: string[];
}

export async function parseFile(file: File): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.csv')) {
    return parseCSV(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcel(file);
  } else {
    return {
      data: [],
      errors: ['不支持的文件格式，请上传CSV或Excel文件'],
    };
  }
}

function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData: ImportRowData[] = [];
        const errors: string[] = [];

        results.data.forEach((row: any, index: number) => {
          try {
            const lineNumber = String(index + 2);
            const parsedRow = parseRowData(row, lineNumber);
            parsedData.push(parsedRow);
          } catch (error) {
            errors.push(`第${index + 2}行: ${error instanceof Error ? error.message : '解析错误'}`);
          }
        });

        resolve({ data: parsedData, errors });
      },
      error: (error) => {
        resolve({ data: [], errors: [`CSV解析错误: ${error.message}`] });
      },
    });
  });
}

function parseExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const parsedData: ImportRowData[] = [];
        const errors: string[] = [];

        jsonData.forEach((row: any, index: number) => {
          try {
            const lineNumber = String(index + 2);
            const parsedRow = parseRowData(row, lineNumber);
            parsedData.push(parsedRow);
          } catch (error) {
            errors.push(`第${index + 2}行: ${error instanceof Error ? error.message : '解析错误'}`);
          }
        });

        resolve({ data: parsedData, errors });
      } catch (error) {
        resolve({ data: [], errors: [`Excel解析错误: ${error instanceof Error ? error.message : '未知错误'}`] });
      }
    };
    reader.onerror = () => {
      resolve({ data: [], errors: ['文件读取失败'] });
    };
    reader.readAsBinaryString(file);
  });
}

function parseRowData(row: any, lineNumber: string): ImportRowData {
  const tradeDate = row['交易日期'] || row['tradeDate'] || row['日期'] || '';
  const stockCode = row['证券代码'] || row['stockCode'] || row['代码'] || '';
  const stockName = row['证券名称'] || row['stockName'] || row['名称'] || '';
  const serialNumber = row['流水号'] || row['serialNumber'] || row['流水编号'] || '';
  const amountStr = row['税费金额'] || row['amount'] || row['金额'] || '0';
  const remark = row['备注'] || row['remark'] || row['说明'] || '';
  const counterTailNumber = row['柜台流水尾号'] || row['counterTailNumber'] || row['流水尾号'] || '';

  if (!tradeDate) throw new Error('缺少交易日期');
  if (!stockCode) throw new Error('缺少证券代码');
  if (!serialNumber) throw new Error('缺少流水号');

  const amount = parseFloat(String(amountStr).replace(/,/g, '')) || 0;

  return {
    lineNumber,
    tradeDate: String(tradeDate).trim(),
    stockCode: String(stockCode).trim(),
    stockName: String(stockName).trim(),
    serialNumber: String(serialNumber).trim(),
    amount,
    remark: String(remark).trim(),
    counterTailNumber: String(counterTailNumber).trim(),
  };
}

export function generateSampleCSV(): string {
  const headers = ['交易日期', '证券代码', '证券名称', '流水号', '税费金额', '备注', '柜台流水尾号'];
  const sampleRows = [
    ['2024-01-15', '00700', '腾讯控股', 'TX20240115001', '125.50', '港股通交易税费-买入', 'A123'],
    ['2024-01-15', '09988', '阿里巴巴-SW', 'AL20240115002', '0.00', '已冲正-误操作取消', 'B456'],
    ['2024-01-16', '03690', '美团-W', 'MT20240116003', '89.20', '港股通交易税费-卖出', 'C789'],
    ['2024-01-16', '00700', '腾讯控股', 'TX20240116004', '156.80', '港股通交易税费-买入', 'A124'],
    ['2024-01-17', '01810', '小米集团-W', 'MI20240117005', '0.00', '已冲正-系统调整', 'D012'],
  ];

  const csvContent = [headers, ...sampleRows].map(row => row.join(',')).join('\n');
  return csvContent;
}
