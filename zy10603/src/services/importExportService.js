const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const ticketService = require('./ticketService');
const { validateImportRow } = require('../validation');

class ImportExportService {
  async importFromCsv(filePath) {
    const results = [];
    const batchId = `batch_${Date.now()}`;
    let rowNumber = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          const validation = validateImportRow(data, rowNumber);
          results.push(validation);
        })
        .on('end', async () => {
          await ticketService.saveValidationResult(batchId, results);
          
          const validRows = results.filter(r => r.isValid);
          for (const row of validRows) {
            try {
              await ticketService.createTicket(row.data);
            } catch (e) {
              const resultIndex = results.findIndex(r => r.rowNumber === row.rowNumber);
              if (resultIndex !== -1) {
                results[resultIndex].isValid = false;
                results[resultIndex].errors.push({
                  field: 'session_id',
                  message: e.message
                });
              }
            }
          }

          resolve({
            batchId,
            total: results.length,
            valid: results.filter(r => r.isValid).length,
            invalid: results.filter(r => !r.isValid).length,
            results
          });
        })
        .on('error', reject);
    });
  }

  async exportToCsv(filePath) {
    const tickets = await ticketService.getAllForExport();
    
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'session_id', title: '会话编号' },
        { id: 'bot_tag', title: '机器人标签' },
        { id: 'human_queue', title: '人工队列' },
        { id: 'customer_emotion', title: '客户情绪' },
        { id: 'status', title: '状态' },
        { id: 'conflict_count', title: '冲突次数' },
        { id: 'history_count', title: '历史记录数' },
        { id: 'created_at', title: '创建时间' },
        { id: 'updated_at', title: '更新时间' }
      ]
    });

    await csvWriter.writeRecords(tickets);
    return { filePath, count: tickets.length };
  }
}

module.exports = new ImportExportService();
