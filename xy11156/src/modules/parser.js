import fs from 'fs/promises';
import path from 'path';

export class BillParser {
  constructor(options = {}) {
    this.options = options;
  }

  async parseFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.json') {
      return this.parseJson(content);
    } else if (ext === '.csv') {
      return this.parseCsv(content);
    }
    throw new Error(`不支持的文件格式: ${ext}`);
  }

  parseJson(content) {
    const data = JSON.parse(content);
    return this.normalizeBillData(data);
  }

  parseCsv(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const bills = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const bill = {};
      headers.forEach((header, idx) => {
        bill[header] = values[idx] || '';
      });
      bills.push(this.normalizeSingleBill(bill));
    }

    return { bills, metadata: { source: 'csv' } };
  }

  normalizeBillData(data) {
    if (Array.isArray(data)) {
      return {
        bills: data.map(b => this.normalizeSingleBill(b)),
        metadata: { source: 'json', count: data.length }
      };
    }
    return {
      bills: (data.bills || []).map(b => this.normalizeSingleBill(b)),
      metadata: data.metadata || { source: 'json' }
    };
  }

  normalizeSingleBill(bill) {
    return {
      billId: bill.billId || bill.id || '',
      billNumber: bill.billNumber || bill.票据编号 || '',
      billDate: bill.billDate || bill.开票日期 || '',
      amount: parseFloat(bill.amount || bill.金额 || 0),
      payer: bill.payer || bill.付款方 || '',
      payee: bill.payee || bill.收款方 || '',
      isRed冲: bill.isRed冲 || bill.是否红冲 === '是' || bill.是否红冲 === true || false,
      relatedBillId: bill.relatedBillId || bill.关联票据号 || '',
      attachmentCount: parseInt(bill.attachmentCount || bill.附件数量 || 0),
      attachmentPages: parseInt(bill.attachmentPages || bill.附件页数 || 0),
      projectName: bill.projectName || bill.项目名称 || '',
      communityName: bill.communityName || bill.小区名称 || '',
      itemType: bill.itemType || bill.费用类型 || '',
      remark: bill.remark || bill.备注 || '',
      status: bill.status || '待校验',
      operator: bill.operator || bill.经办人 || '',
      originalData: { ...bill }
    };
  }

  async parseDirectory(dirPath) {
    const files = await fs.readdir(dirPath);
    const billFiles = files.filter(f => 
      ['.json', '.csv'].includes(path.extname(f).toLowerCase())
    );
    
    const allBills = [];
    for (const file of billFiles) {
      const filePath = path.join(dirPath, file);
      try {
        const result = await this.parseFile(filePath);
        allBills.push({
          file,
          ...result
        });
      } catch (error) {
        allBills.push({
          file,
          error: error.message,
          bills: []
        });
      }
    }
    return allBills;
  }
}

export default BillParser;
