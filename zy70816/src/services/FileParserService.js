const fs = require('fs');
const csv = require('csv-parser');
const { marked } = require('marked');

class FileParserService {
  static parseInventoryCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          const inventoryData = results.map(row => ({
            batch_no: row['批号'] || row['batch_no'] || row['BatchNo'],
            product_code: row['产品编码'] || row['product_code'] || row['ProductCode'],
            product_name: row['产品名称'] || row['product_name'] || row['ProductName'],
            supplier_code: row['供应商编码'] || row['supplier_code'] || row['SupplierCode'],
            production_date: row['生产日期'] || row['production_date'] || row['ProductionDate'],
            expiry_date: row['有效期'] || row['expiry_date'] || row['ExpiryDate'],
            quantity: parseInt(row['数量'] || row['quantity'] || row['Quantity'] || 0),
            store_code: row['门店编码'] || row['store_code'] || row['StoreCode'],
            warehouse_location: row['库位'] || row['warehouse_location'] || row['Location']
          }));
          resolve(inventoryData);
        })
        .on('error', reject);
    });
  }

  static parseConsumptionCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          const consumptionData = results.map(row => ({
            store_code: row['门店编码'] || row['store_code'] || row['StoreCode'],
            batch_no: row['批号'] || row['batch_no'] || row['BatchNo'],
            consumption_date: row['消耗日期'] || row['consumption_date'] || row['ConsumptionDate'],
            quantity: parseInt(row['消耗数量'] || row['quantity'] || row['Quantity'] || 0),
            used_by: row['使用人'] || row['used_by'] || row['UsedBy'],
            patient_info: row['患者信息'] || row['patient_info'] || row['PatientInfo'],
            notes: row['备注'] || row['notes'] || row['Notes']
          }));
          resolve(consumptionData);
        })
        .on('error', reject);
    });
  }

  static parseRecallMarkdown(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) {
          reject(err);
          return;
        }

        const lines = content.split('\n');
        let recall_no = '';
        let title = '';
        let reason = '';
        let level = 'general';
        let published_date = '';
        let publisher = '';
        let batch_nos = [];

        for (const line of lines) {
          if (line.startsWith('# ') || line.startsWith('## ')) {
            const header = line.replace(/^#+\s*/, '');
            if (header.includes('召回') || header.includes('Recall')) {
              title = header;
              const noMatch = header.match(/[A-Za-z0-9-]+/);
              if (noMatch) recall_no = noMatch[0];
            }
          } else if (line.includes('批号') || line.includes('BatchNo') || line.includes('批次')) {
            const matches = line.match(/[A-Za-z0-9-]{6,}/g);
            if (matches) {
              batch_nos = [...new Set([...batch_nos, ...matches])];
            }
          } else if (line.includes('原因') || line.includes('Reason')) {
            reason = line.replace(/^.*[:：]\s*/, '').trim();
          } else if (line.includes('级别') || line.includes('Level') || line.includes('等级')) {
            if (line.includes('紧急') || line.includes('urgent') || line.includes('high')) {
              level = 'urgent';
            } else if (line.includes('警告') || line.includes('warning') || line.includes('medium')) {
              level = 'warning';
            }
          } else if (line.includes('发布日期') || line.includes('Published')) {
            const dateMatch = line.match(/\d{4}[-/]\d{2}[-/]\d{2}/);
            if (dateMatch) published_date = dateMatch[0];
          } else if (line.includes('发布人') || line.includes('Publisher')) {
            publisher = line.replace(/^.*[:：]\s*/, '').trim();
          }
        }

        resolve({
          recall_no: recall_no || `RC${Date.now()}`,
          title: title || '产品召回公告',
          content: content,
          batch_nos: batch_nos.join(','),
          reason: reason || '产品质量问题',
          level,
          published_date: published_date || new Date().toISOString().split('T')[0],
          publisher: publisher || '系统'
        });
      });
    });
  }

  static renderMarkdown(content) {
    return marked(content);
  }
}

module.exports = FileParserService;
