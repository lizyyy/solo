import * as XLSX from 'xlsx';
import type { FileParseResult, ValuationRecord } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

export const parseFile = async (file: File): Promise<FileParseResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) {
          resolve({
            success: false,
            data: [],
            errors: ['文件内容为空或格式不正确']
          });
          return;
        }

        const headers = jsonData[0].map(h => String(h).trim());
        const rows = jsonData.slice(1);
        
        const records: Partial<ValuationRecord>[] = [];
        const errors: string[] = [];
        
        rows.forEach((row, rowIndex) => {
          if (row.every(cell => !cell || String(cell).trim() === '')) return;
          
          const record: Partial<ValuationRecord> = {
            id: generateId(),
            versions: [],
            judgments: [],
            isFalsePositive: false
          };
          
          headers.forEach((header, colIndex) => {
            const value = row[colIndex];
            switch (header) {
              case '交易编号':
              case 'tradeId':
                record.tradeId = String(value || '');
                break;
              case '交易对手':
              case 'counterparty':
                record.counterparty = String(value || '');
                break;
              case '产品类型':
              case 'productType':
                record.productType = String(value || '');
                break;
              case '名义本金':
              case 'notionalAmount':
                record.notionalAmount = Number(value) || 0;
                break;
              case '说明':
              case 'description':
              case '备注':
                record.currentRemark = String(value || '');
                break;
            }
          });
          
          const versionHeaderIndex = headers.findIndex(h => 
            h === '估值版本' || h === 'version'
          );
          const valuationHeaderIndex = headers.findIndex(h => 
            h === '估值金额' || h === '估值' || h === 'valuation'
          );
          const descHeaderIndex = headers.findIndex(h => 
            h === '说明' || h === 'description' || h === '备注'
          );
          
          if (versionHeaderIndex >= 0 || valuationHeaderIndex >= 0) {
            record.versions = [{
              id: generateId(),
              recordId: record.id!,
              version: row[versionHeaderIndex] || 'V1',
              valuation: Number(row[valuationHeaderIndex]) || 0,
              description: row[descHeaderIndex] || '导入数据',
              createdAt: new Date().toISOString(),
              operator: '系统导入'
            }];
          }
          
          if (!record.tradeId || !record.counterparty) {
            errors.push(`第 ${rowIndex + 2} 行：缺少必填字段（交易编号、交易对手）`);
          } else {
            record.currentStatus = 'pending';
            record.createdAt = new Date().toISOString();
            record.updatedAt = new Date().toISOString();
            records.push(record);
          }
        });
        
        resolve({
          success: errors.length === 0,
          data: records,
          errors: errors.length > 0 ? errors : undefined
        });
      } catch (err) {
        resolve({
          success: false,
          data: [],
          errors: [`文件解析失败：${err instanceof Error ? err.message : '未知错误'}`]
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        success: false,
        data: [],
        errors: ['文件读取失败']
      });
    };
    
    reader.readAsBinaryString(file);
  });
};

export const downloadTemplate = (): void => {
  const headers = ['交易编号', '交易对手', '产品类型', '名义本金', '估值金额', '估值版本', '说明'];
  const sampleData = [
    ['OTC20240001', '中信证券', '欧式看涨', 10000000, 1250000, 'V1', '初步估值'],
    ['OTC20240002', '华泰证券', '雪球', 50000000, 8500000, 'V2', '调整后估值']
  ];
  
  const wsData = [headers, ...sampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '估值数据');
  XLSX.writeFile(wb, '估值导入模板.xlsx');
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
