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
        let isInBatchSection = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();

          if (line.startsWith('# ')) {
            const header = line.replace(/^#+\s*/, '').trim();
            if (!title && (header.includes('召回') || header.includes('Recall'))) {
              title = header;
              const noMatch = header.match(/RC[A-Za-z0-9-]+/);
              if (noMatch) {
                recall_no = noMatch[0];
              } else {
                const noMatchFallback = header.match(/[A-Za-z0-9-]{6,}/);
                if (noMatchFallback) recall_no = noMatchFallback[0];
              }
            }
          }

          if (trimmedLine.startsWith('## ') || trimmedLine.startsWith('### ')) {
            const sectionTitle = trimmedLine.replace(/^#+\s*/, '').trim();
            isInBatchSection = sectionTitle.includes('涉及批次') || 
                               sectionTitle.includes('批次') || 
                               sectionTitle.includes('Affected') ||
                               sectionTitle.includes('Batch');
          }

          if (isInBatchSection) {
            const matches = trimmedLine.match(/BATCH[A-Za-z0-9-]+/g);
            if (matches) {
              batch_nos = [...new Set([...batch_nos, ...matches])];
            }
          }

          if (!isInBatchSection) {
            const matches = trimmedLine.match(/BATCH[A-Za-z0-9-]+/g);
            if (matches) {
              batch_nos = [...new Set([...batch_nos, ...matches])];
            }
          }

          if (trimmedLine.startsWith('- **召回原因**') || 
              trimmedLine.startsWith('- **原因**') ||
              trimmedLine.startsWith('**召回原因**') ||
              trimmedLine.startsWith('**原因**')) {
            reason = trimmedLine.replace(/^.*[:：]\s*/, '').trim()
                                .replace(/^\*\*/, '')
                                .replace(/\*\*$/, '')
                                .trim();
          }

          if (trimmedLine.includes('召回级别') || trimmedLine.includes('紧急程度') || 
              trimmedLine.includes('Urgency') || trimmedLine.includes('Severity')) {
            if (trimmedLine.includes('紧急') || trimmedLine.includes('urgent') || 
                trimmedLine.includes('high') || trimmedLine.includes('Urgent')) {
              level = 'urgent';
            } else if (trimmedLine.includes('警告') || trimmedLine.includes('warning') || 
                       trimmedLine.includes('medium')) {
              level = 'warning';
            }
          }

          if (trimmedLine.includes('发布日期') || trimmedLine.includes('Published') || 
              trimmedLine.includes('发布时间')) {
            const dateMatch = trimmedLine.match(/\d{4}[-/]\d{2}[-/]\d{2}/);
            if (dateMatch) published_date = dateMatch[0];
          }

          if (trimmedLine.includes('发布人') || trimmedLine.includes('Publisher') ||
              trimmedLine.includes('发布单位')) {
            const match = trimmedLine.match(/[:：]\s*(.+)$/);
            if (match) {
              publisher = match[1].trim().replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
            }
          }
        }

        if (!reason) {
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('## 召回原因') || lines[i].includes('### 召回原因')) {
              for (let j = i + 1; j < lines.length && j < i + 5; j++) {
                if (lines[j].trim() && !lines[j].startsWith('#')) {
                  reason = lines[j].trim();
                  break;
                }
              }
            }
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
